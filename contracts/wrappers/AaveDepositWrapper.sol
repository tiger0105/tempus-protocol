// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../ITempusPool.sol";
import "../mocks/AAVE/ILendingPool.sol";

contract AaveDepositWrapper {
    using SafeERC20 for IERC20;

    ITempusPool internal immutable pool;
    address internal immutable backingToken;
    address internal immutable yieldBearingToken;
    ILendingPool internal immutable aavePool;

    constructor(
        ITempusPool _pool,
        ILendingPool _aavePool,
        address _backingToken
    ) {
        pool = _pool;
        backingToken = _backingToken;
        yieldBearingToken = _pool.yieldBearingToken();
        aavePool = _aavePool; // TODO: retrieve this from IAToken(yieldBearingToken).POOL()
    }

    /// Deposits backing token to the appropriate AAVE pool, and then to Tempus Pool.
    /// `msg.sender` must approve `amount` of backing token to this wrapper.
    ///
    /// @return Amount of TPS and TYS minted to `msg.sender`
    function deposit(uint256 amount) external returns (uint256) {
        // Transfer backingToken to the wrapper
        IERC20(backingToken).safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to AAVE
        IERC20(backingToken).approve(address(aavePool), amount);
        aavePool.deposit(backingToken, amount, address(this), 0);
        // TODO: Should we record the balance prior to deposit and only transmit the difference?
        //       In case someone transfers aDAI directly to this wrapper, that would be sent to the
        //       next random person doing a deposit, or if we do that check, it would be locked up.
        uint256 yieldBearingAmount = IERC20(yieldBearingToken).balanceOf(address(this));

        // Deposit to the TempusPool
        IERC20(yieldBearingToken).approve(address(pool), yieldBearingAmount);
        return pool.deposit(yieldBearingAmount, msg.sender);
    }
}
