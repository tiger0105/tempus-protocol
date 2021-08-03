// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../ITempusPool.sol";
import "../mocks/aave/IAToken.sol";
import "../mocks/aave/ILendingPool.sol";

contract AaveDepositWrapper {
    using SafeERC20 for IERC20;

    ITempusPool internal immutable pool;
    IERC20 internal immutable backingToken;
    IERC20 internal immutable yieldBearingToken;
    ILendingPool internal immutable aavePool;

    constructor(ITempusPool _pool) {
        pool = _pool;
        IAToken _yieldBearingToken = IAToken(_pool.yieldBearingToken());
        yieldBearingToken = IERC20(address(_yieldBearingToken));
        aavePool = _yieldBearingToken.POOL();
        backingToken = IERC20(_yieldBearingToken.UNDERLYING_ASSET_ADDRESS());
    }

    /// @dev Deposits backing token to the appropriate AAVE pool, and then to Tempus Pool.
    ///      `msg.sender` must approve `amount` of backing token to this wrapper.
    ///
    /// @return Amount of TPS and TYS minted to `msg.sender`
    function deposit(uint256 amount) external returns (uint256) {
        // Transfer backingToken to the wrapper
        backingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to AAVE
        backingToken.approve(address(aavePool), amount);
        aavePool.deposit(address(backingToken), amount, address(this), 0);

        uint256 yieldBearingAmount = yieldBearingToken.balanceOf(address(this));

        // Deposit to the TempusPool
        yieldBearingToken.approve(address(pool), yieldBearingAmount);
        return pool.deposit(yieldBearingAmount, msg.sender);
    }

    /// @dev Redeem TPS+TYS held by msg.sender into backing tokens
    ///      `msg.sender` must approve TPS and TYS amounts to this wrapper.
    ///      `msg.sender` will receive the backing tokens
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem
    /// @return Amount of backing tokens redeemed to `msg.sender`
    function redeem(uint256 principalAmount, uint256 yieldAmount) external returns (uint256) {
        // Transfer TPS and TYS to the wrapper
        pool.principalShare().safeTransferFrom(msg.sender, address(this), principalAmount);
        pool.yieldShare().safeTransferFrom(msg.sender, address(this), yieldAmount);

        uint256 yieldBearingTokens = pool.redeem(principalAmount, yieldAmount);
        // -- deposit wrapper now owns YBT
        assert(yieldBearingToken.balanceOf(address(this)) >= yieldBearingTokens);

        backingToken.approve(msg.sender, yieldBearingTokens);
        return aavePool.withdraw(address(backingToken), yieldBearingTokens, msg.sender);
    }
}
