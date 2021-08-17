// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./IPriceOracle.sol";
import "./ITempusPool.sol";
import "./token/PrincipalShare.sol";
import "./token/YieldShare.sol";
import "./math/Fixed256x18.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPool is ITempusPool, Ownable {
    using SafeERC20 for IERC20;
    using Fixed256x18 for uint256;

    uint public constant override version = 1;

    bytes32 public immutable override protocolName;

    IPriceOracle public immutable priceOracle;
    address public immutable override yieldBearingToken;

    uint256 public immutable override startTime;
    uint256 public immutable override maturityTime;

    uint256 public immutable override initialInterestRate;
    uint256 public maturityInterestRate;
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
        uint256 maturity,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    ) {
        require(maturity > block.timestamp, "maturityTime is after startTime");

        protocolName = oracle.protocolName();
        yieldBearingToken = token;
        priceOracle = oracle;
        startTime = block.timestamp;
        maturityTime = maturity;
        initialInterestRate = oracle.updateInterestRate(token);

        principalShare = new PrincipalShare(this, principalName, principalSymbol);
        yieldShare = new YieldShare(this, yieldName, yieldSymbol);
    }

    /// Finalize the pool after maturity.
    function finalize() public override {
        if (!matured) {
            require(block.timestamp >= maturityTime, "Maturity not been reached yet.");
            maturityInterestRate = currentInterestRate();
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
        totalFees -= amount;

        IERC20 token = IERC20(yieldBearingToken);
        token.approve(address(this), amount);
        token.safeTransferFrom(address(this), recipient, amount);
    }

    /// @dev Deposits yield bearing tokens (such as cDAI) into TempusPool
    ///      msg.sender must approve `yieldTokenAmount` to this TempusPool
    /// @param yieldTokenAmount Amount of yield bearing tokens to deposit
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return Amount of TPS and TYS minted to `recipient`
    function deposit(uint256 yieldTokenAmount, address recipient) public override returns (uint256) {
        require(!matured, "Maturity reached.");
        uint256 rate = priceOracle.updateInterestRate(yieldBearingToken);
        require(rate >= initialInterestRate, "Negative yield!");

        // Collect the deposit
        IERC20(yieldBearingToken).safeTransferFrom(msg.sender, address(this), yieldTokenAmount);

        // Collect fees if they are set, reducing the number of tokens for the sender
        // thus leaving more YBT in the TempusPool than there are minted TPS/TYS
        uint256 tokenAmount = yieldTokenAmount;
        uint256 depositFees = feesConfig.depositPercent;
        if (depositFees != 0) {
            uint256 fee = tokenAmount.mulf18(depositFees);
            tokenAmount -= fee;
            totalFees += fee;
        }

        // Issue appropriate shares
        uint256 backingTokenDepositAmount = priceOracle.numAssetsPerYieldToken(tokenAmount, rate);
        uint256 tokensToIssue = (backingTokenDepositAmount * initialInterestRate) / rate;

        PrincipalShare(address(principalShare)).mint(recipient, tokensToIssue);
        YieldShare(address(yieldShare)).mint(recipient, tokensToIssue);

        emit Deposited(msg.sender, recipient, tokenAmount, tokensToIssue, rate);

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
        uint256 currentRate = priceOracle.updateInterestRate(yieldBearingToken);
        uint256 interestRate = currentRate;
        // in case of negative yield after maturity, we use lower rate for redemption
        // so, we need to change from currentRate to maturity rate only if maturity rate is lower
        if (matured && currentRate > maturityInterestRate) {
            interestRate = maturityInterestRate;
        }

        uint256 redeemableBackingTokens;
        if (interestRate < initialInterestRate) {
            redeemableBackingTokens = (principalAmount * interestRate) / initialInterestRate;
        } else {
            uint256 rateDiff = interestRate - initialInterestRate;
            // this is expressed in backing token
            uint256 amountPerYieldShareToken = rateDiff.divf18(initialInterestRate);
            uint256 redeemAmountFromYieldShares = yieldAmount.mulf18(amountPerYieldShareToken);

            // TODO: Scale based on number of decimals for tokens
            redeemableBackingTokens = principalAmount + redeemAmountFromYieldShares;
        }

        // Burn the appropriate shares
        PrincipalShare(address(principalShare)).burn(msg.sender, principalAmount);
        YieldShare(address(yieldShare)).burn(msg.sender, yieldAmount);

        uint256 redeemableYieldTokens = priceOracle.numYieldTokensPerAsset(redeemableBackingTokens, currentRate);

        // Collect fees on redeem
        uint256 redeemFees = matured ? feesConfig.matureRedeemPercent : feesConfig.earlyRedeemPercent;
        if (redeemFees != 0) {
            uint256 fee = redeemableYieldTokens.mulf18(redeemFees);
            redeemableYieldTokens -= fee;
            totalFees += fee;
        }

        IERC20(yieldBearingToken).safeTransfer(msg.sender, redeemableYieldTokens);

        emit Redeemed(msg.sender, principalAmount, yieldAmount, redeemableYieldTokens, interestRate);

        return redeemableYieldTokens;
    }

    function currentInterestRate() public view override returns (uint256) {
        return priceOracle.storedInterestRate(yieldBearingToken);
    }

    function pricePerYieldShare() public view override returns (uint256) {
        uint256 currentRate = currentInterestRate();
        uint256 initialRate = initialInterestRate;

        // TODO: Not finished, needs additional testing later
        uint256 rate = (currentRate - initialRate).divf18(initialRate);
        return rate;
    }
}
