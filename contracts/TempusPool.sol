// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IPriceOracle.sol";
import "./ITempusPool.sol";
import "./token/PrincipalShare.sol";
import "./token/YieldShare.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPool is ITempusPool, Ownable {
    using SafeERC20 for IERC20;

    uint public constant override version = 1;

    uint256 private constant EXCHANGE_RATE_PRECISION = 1e18;
    uint256 private constant FEE_PRECISION = 1e18;

    IPriceOracle public immutable priceOracle;
    address public immutable override yieldBearingToken;

    uint256 public immutable override startTime;
    uint256 public immutable override maturityTime;

    uint256 public immutable override initialExchangeRate;
    uint256 public maturityExchangeRate;
    IERC20 public immutable override principalShare;
    IERC20 public immutable override yieldShare;

    bool public override matured;

    struct FeesConfig {
        /// @dev Percentage of Yield Bearing Tokens (YBT) taken as fee during deposit()
        uint256 depositPercent;
        /// @dev Percentage of Yield Bearing Tokens (YBT)
        ///      taken as fee during early redeem()
        uint256 earlyRedeemPercent;
        /// @dev Percentage of Yield Bearing Tokens (YBT)
        ///      taken as fee after maturity time during redeem()
        uint256 matureRedeemPercent;
    }

    FeesConfig public feesConfig;

    /// total amount of fees accumulated in pool
    uint256 public totalFees;

    /// Constructs Pool with underlying token, start and maturity date
    /// @param token underlying yield bearing token
    /// @param oracle the price oracle correspoding to the token
    /// @param maturity maturity time of this pool
    constructor(
        address token,
        IPriceOracle oracle,
        uint256 maturity
    ) {
        require(maturity > block.timestamp, "maturityTime is after startTime");

        yieldBearingToken = token;
        priceOracle = oracle;
        startTime = block.timestamp;
        maturityTime = maturity;
        initialExchangeRate = oracle.currentRate(token);

        string memory principalName = string(bytes.concat("TPS-", bytes(ERC20(token).symbol())));
        principalShare = new PrincipalShare(this, principalName, principalName);

        string memory yieldName = string(bytes.concat("TYS-", bytes(ERC20(token).symbol())));
        yieldShare = new YieldShare(this, yieldName, yieldName);
    }

    /// Finalize the pool after maturity.
    function finalize() public override {
        if (!matured) {
            require(block.timestamp >= maturityTime, "Maturity not been reached yet.");
            maturityExchangeRate = currentExchangeRate();
            matured = true;

            assert(principalShare.totalSupply() == yieldShare.totalSupply());
        }
    }

    /// @dev Sets the fees config for this pool. By default all fees are 0
    function setFeesConfig(FeesConfig calldata newFeesConfig) public onlyOwner {
        feesConfig = newFeesConfig;
    }

    /// @dev Transfers accumulated Yield Bearing Token (YBT) fees
    ///      from this pool contract to `recipient`
    /// @param recipient Address which will receive the specified amount of YBT
    /// @param amount Amount of YBT to transfer, cannot be more than contract's `totalFees`
    ///               If amount is uint256.max, then all accumulated fees are transferred.
    function transferFees(address recipient, uint256 amount) public onlyOwner {
        if (amount == type(uint256).max) {
            amount = totalFees;
        } else {
            require(amount <= totalFees, "not enough accumulated fees");
        }
        IERC20 token = IERC20(yieldBearingToken);
        token.approve(address(this), amount);
        token.safeTransferFrom(address(this), recipient, amount);
        totalFees -= amount;
    }

    /// @dev Deposits yield bearing tokens (such as cDAI) into TempusPool
    ///      msg.sender must approve `yieldTokenAmount` to this TempusPool
    /// @param yieldTokenAmount Amount of yield bearing tokens to deposit
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return Amount of TPS and TYS minted to `recipient`
    function deposit(uint256 yieldTokenAmount, address recipient) public override returns (uint256) {
        require(!matured, "Maturity reached.");
        require(currentExchangeRate() >= initialExchangeRate, "Negative yield!");

        // Collect the deposit
        IERC20(yieldBearingToken).safeTransferFrom(msg.sender, address(this), yieldTokenAmount);

        // Collect fees if they are set, reducing the number of tokens for the sender
        // thus leaving more YBT in the TempusPool than there are minted TPS/TYS
        uint256 tokenAmount = yieldTokenAmount;
        uint256 depositFees = feesConfig.depositPercent;
        if (depositFees != 0) {
            uint256 fee = (tokenAmount * depositFees) / FEE_PRECISION;
            tokenAmount -= fee;
            totalFees += fee;
        }

        // Issue appropriate shares
        uint256 backingTokenDepositAmount = priceOracle.scaledBalance(yieldBearingToken, tokenAmount);
        uint256 tokensToIssue = (backingTokenDepositAmount * initialExchangeRate) / currentExchangeRate();

        PrincipalShare(address(principalShare)).mint(recipient, tokensToIssue);
        YieldShare(address(yieldShare)).mint(recipient, tokensToIssue);
        return tokensToIssue;
    }

    /// @dev Redeem yield bearing tokens from this TempusPool
    ///      msg.sender will receive the YBT
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem for YBT
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem for YBT
    /// @return Amount of Yield Bearing Tokens redeemed to `msg.sender`
    function redeem(uint256 principalAmount, uint256 yieldAmount) public override returns (uint256) {
        require(principalShare.balanceOf(msg.sender) >= principalAmount, "Insufficient principal balance.");
        require(yieldShare.balanceOf(msg.sender) >= yieldAmount, "Insufficient yield balance.");

        // Redeeming prior to maturity is only allowed in equal amounts.
        require(matured || (principalAmount == yieldAmount), "Inequal redemption not allowed before maturity.");

        return _redeem(principalAmount, yieldAmount);
    }

    function _redeem(uint256 principalAmount, uint256 yieldAmount) internal returns (uint256) {
        uint256 currentRate = currentExchangeRate();
        uint256 exchangeRate = currentRate;
        // in case of negative yield after maturity, we use lower rate for redemption
        // so, we need to change from currentRate to maturity rate only if maturity rate is lower
        if (matured && currentRate > maturityExchangeRate) {
            exchangeRate = maturityExchangeRate;
        }

        uint256 redeemableBackingTokens;
        if (exchangeRate < initialExchangeRate) {
            redeemableBackingTokens = (principalAmount * exchangeRate) / initialExchangeRate;
        } else {
            uint256 rateDiff = exchangeRate - initialExchangeRate;
            // this is expressed in backing token
            uint256 amountPerYieldShareToken = (EXCHANGE_RATE_PRECISION * rateDiff) / initialExchangeRate;
            uint256 redeemAmountFromYieldShares = (yieldAmount * amountPerYieldShareToken) / EXCHANGE_RATE_PRECISION;

            // TODO: Scale based on number of decimals for tokens
            redeemableBackingTokens = principalAmount + redeemAmountFromYieldShares;
        }

        // Burn the appropriate shares
        PrincipalShare(address(principalShare)).burn(msg.sender, principalAmount);
        YieldShare(address(yieldShare)).burn(msg.sender, yieldAmount);

        uint256 redeemableYieldTokens = priceOracle.numYieldTokensPerAsset(yieldBearingToken, redeemableBackingTokens);

        // Collect fees on redeem
        uint256 redeemFees = matured ? feesConfig.matureRedeemPercent : feesConfig.earlyRedeemPercent;
        if (redeemFees != 0) {
            uint256 fee = (redeemableYieldTokens * redeemFees) / FEE_PRECISION;
            redeemableYieldTokens -= fee;
            totalFees += fee;
        }

        IERC20(yieldBearingToken).safeTransfer(msg.sender, redeemableYieldTokens);
        return redeemableYieldTokens;
    }

    function currentExchangeRate() public view override returns (uint256) {
        return priceOracle.currentRate(yieldBearingToken);
    }

    function pricePerYieldShare() public view override returns (uint256) {
        uint256 currentRate = currentExchangeRate();
        uint256 initialRate = initialExchangeRate;

        // TODO: Not finished, needs additional testing later
        uint256 rate = (1e18 * (currentRate - initialRate)) / initialRate;
        return rate;
    }
}
