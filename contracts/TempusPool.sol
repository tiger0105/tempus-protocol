// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./ITempusPool.sol";
import "./token/PrincipalShare.sol";
import "./token/YieldShare.sol";

import "./mocks/AAVE/ATokenMock.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPool is ITempusPool {
    using SafeERC20 for IERC20;

    address public override yieldBearingToken;

    uint256 public override startTime;
    uint256 public override maturityTime;

    uint256 public initialExchangeRate;
    PrincipalShare public principalShare;
    YieldShare public yieldShare;

    /// Constructs Pool with underlying token, start and maturity date
    /// @param token underlying collateral token
    /// @param start start time of this pool
    /// @param maturity maturity time of this pool
    constructor(
        address token,
        uint256 start,
        uint256 maturity
    ) {
        yieldBearingToken = token;
        startTime = start;
        maturityTime = maturity;
        initialExchangeRate = currentExchangeRate();

        // TODO add maturity
        string memory principalName = string(bytes.concat("TPS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        principalShare = new PrincipalShare(principalName, principalName);

        // TODO add maturity
        string memory yieldName = string(bytes.concat("TYS-", bytes(ERC20(token).symbol())));
        // TODO separate name vs. symbol?
        yieldShare = new YieldShare(yieldName, yieldName);
    }

    function deposit(uint256 tokenAmount) public override {
        // Collect the deposit
        IERC20(yieldBearingToken).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Issue appropriate shares
        uint256 tokensToIssue = (tokenAmount * initialExchangeRate) / currentExchangeRate();
        principalShare.mint(msg.sender, tokensToIssue);
        yieldShare.mint(msg.sender, tokensToIssue);
    }

    function currentExchangeRate() public view returns (uint256) {
        // TODO implement
        ATokenMock atoken = ATokenMock(yieldBearingToken);
        return atoken.POOL().getReserveNormalizedIncome(atoken.UNDERLYING_ASSET_ADDRESS());
    }
}
