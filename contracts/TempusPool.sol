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

    IPriceOracle public immutable priceOracle;
    address public immutable override yieldBearingToken;

    uint256 public immutable override startTime;
    uint256 public immutable override maturityTime;

    uint256 public immutable override initialExchangeRate;
    uint256 public maturityExchangeRate;
    PrincipalShare public immutable principalShare;
    YieldShare public immutable yieldShare;

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

    FeesConfig public fees;

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

        // TODO add maturity
        string memory principalName = string(bytes.concat("TPS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        principalShare = new PrincipalShare(this, principalName, principalName);

        // TODO add maturity
        string memory yieldName = string(bytes.concat("TYS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        yieldShare = new YieldShare(this, yieldName, yieldName);
    }

    /// Finalize the pool after maturity.
    function finalize() public override {
        if (!matured) {
            require(block.timestamp >= maturityTime, "Maturity not been reached yet.");
            maturityExchangeRate = currentExchangeRate();
            matured = true;
        }
    }

    /// @dev Sets the fees for this pool. By default all fees are 0
    function setFees(FeesConfig calldata newFees) public onlyOwner {
        fees = newFees;
    }

    /// @dev Deposits yield bearing tokens (such as cDAI) into TempusPool
    ///      msg.sender must approve `yieldTokenAmount` to this TempusPool
    /// @param yieldTokenAmount Amount of yield bearing tokens to deposit
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return Amount of TPS and TYS minted to `recipient`
    function deposit(uint256 yieldTokenAmount, address recipient) public override returns (uint256) {
        require(!matured, "Maturity reached.");

        // Collect the deposit
        IERC20(yieldBearingToken).safeTransferFrom(msg.sender, address(this), yieldTokenAmount);

        // Collect fees if they are set, reducing the number of tokens for the sender
        // thus leaving more YBT in the TempusPool than there are minted TPS/TYS
        uint256 tokenAmount = yieldTokenAmount;
        uint256 depositFees = fees.depositPercent;
        if (depositFees != 0) {
            tokenAmount -= (tokenAmount * depositFees) / 1e18;
        }

        // Issue appropriate shares
        uint256 tokensToIssue = (tokenAmount * initialExchangeRate) / EXCHANGE_RATE_PRECISION;
        principalShare.mint(recipient, tokensToIssue);
        yieldShare.mint(recipient, tokensToIssue);
        return tokensToIssue;
    }

    function redeem(uint256 principalAmount, uint256 yieldAmount) public override {
        require(principalShare.balanceOf(msg.sender) >= principalAmount, "Insufficient principal balance.");
        require(yieldShare.balanceOf(msg.sender) >= yieldAmount, "Insufficient yield balance.");

        // Redeeming prior to maturity is only allowed in equal amounts.
        require(matured || (principalAmount == yieldAmount), "Inequal redemption not allowed before maturity.");

        // TODO: implement
        revert("Unimplemented.");
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
