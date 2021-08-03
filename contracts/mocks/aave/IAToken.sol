// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./ILendingPool.sol";

// NOTE: Based on the actual AToken implementation
interface IAToken {
    /// @return The underlying backing token.
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);

    /// @return The underlying ILendingPool associated with this token.
    function POOL() external view returns (ILendingPool);
}
