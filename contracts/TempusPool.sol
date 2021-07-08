// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./IAssetPool.sol";
import "./ITempusPool.sol";
import "./token/PrincipalShare.sol";
import "./token/YieldShare.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPool is ITempusPool {
    using SafeERC20 for IERC20;

    uint public constant override version = 1;

    IAssetPool public immutable assetPool;
    address public immutable override yieldBearingToken;

    uint public immutable override startTime;
    uint public immutable override maturityTime;

    uint public immutable initialExchangeRate;
    PrincipalShare public immutable principalShare;
    YieldShare public immutable yieldShare;

    /// Constructs Pool with underlying token, start and maturity date
    /// @param pool Asset pool which manages the Yield Bearing Token
    /// @param maturity maturity time of this pool
    constructor(IAssetPool pool, uint maturity) {
        require(maturity > block.timestamp, "maturityTime is after startTime");

        address token = pool.yieldToken();
        yieldBearingToken = token;
        assetPool = pool;
        startTime = block.timestamp;
        maturityTime = maturity;
        initialExchangeRate = pool.currentRate();

        // TODO add maturity
        string memory principalName = string(bytes.concat("TPS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        principalShare = new PrincipalShare(this, principalName, principalName);

        // TODO add maturity
        string memory yieldName = string(bytes.concat("TYS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        yieldShare = new YieldShare(this, yieldName, yieldName);
    }

    /// @dev Deposits yield bearing tokens (such as cDAI) into tempus pool
    /// @param onBehalfOf Address whichs holds the depositable Yield Bearing Tokens and
    ///                   will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    ///                   This account must approve() tokenAmount to this Tempus Pool
    /// @param tokenAmount Number of yield bearing tokens to deposit
    function deposit(address onBehalfOf, uint tokenAmount) public override {
        tempusDeposit(onBehalfOf, onBehalfOf, tokenAmount);
    }

    /// @dev Deposits asset tokens (such as DAI or ETH) into tempus pool on behalf of sender
    /// @param tokenAmount Number of asset tokens to deposit
    function depositAsset(uint tokenAmount) public override {
        // deposit asset and receive YBT such a cDAI or aDAI into Tempus pool
        assetPool.depositAsset(address(this), tokenAmount);

        // mint TPS and TYS to sender
        tempusDeposit(address(this), msg.sender, tokenAmount);
    }

    /// deposit YBT into tempus pool, mint TPS and TYS to recipient
    function tempusDeposit(
        address from,
        address recipient,
        uint tokenAmount
    ) internal {
        // Collect the deposit
        IERC20(yieldBearingToken).safeTransferFrom(from, address(this), tokenAmount);

        // Issue appropriate shares
        uint tokensToIssue = (tokenAmount * initialExchangeRate) / currentExchangeRate();
        principalShare.mint(recipient, tokensToIssue);
        yieldShare.mint(recipient, tokensToIssue);
    }

    /// The current exchange rate of yield bearing token versus its backing.
    /// @return The rate.
    function currentExchangeRate() public view override returns (uint) {
        return assetPool.currentRate();
    }
}
