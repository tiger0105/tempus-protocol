// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

// Based on https://github.com/aave/protocol-v2/blob/ice/mainnet-deployment-03-12-2020/contracts/interfaces/ILendingPool.sol
interface ILendingPool {
    /// @dev Returns the normalized income normalized income of the reserve
    /// @param asset The address of the underlying asset of the reserve
    /// @return The reserve's normalized income
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}
