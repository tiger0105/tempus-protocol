// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../TempusPool.sol";
import "../protocols/aave/IAToken.sol";
import "../protocols/aave/ILendingPool.sol";

contract AaveTempusPool is TempusPool {
    using SafeERC20 for IERC20;

    ILendingPool internal immutable aavePool;

    constructor(
        IAToken token,
        IPriceOracle oracle,
        uint256 maturity,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    )
        TempusPool(
            address(token),
            token.UNDERLYING_ASSET_ADDRESS(),
            oracle,
            maturity,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol
        )
    {
        aavePool = token.POOL();
    }

    function depositToUnderlying(uint256 amount) internal override returns (uint256) {
        require(msg.value == 0, "ETH deposits not supported");

        // Pull user's Backing Tokens
        IERC20(backingToken).safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to AAVE
        IERC20(backingToken).safeIncreaseAllowance(address(aavePool), amount);
        aavePool.deposit(address(backingToken), amount, address(this), 0);

        return amount; // With Aave, the of YBT minted equals to the amount of deposited BT
    }

    function withdrawFromUnderlyingProtocol(uint256 yieldBearingTokensAmount, address recipient)
        internal
        override
        returns (uint256 backingTokenAmount)
    {
        return aavePool.withdraw(backingToken, yieldBearingTokensAmount, recipient);
    }
}
