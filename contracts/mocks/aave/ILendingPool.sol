// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

// Based on https://github.com/aave/protocol-v2/blob/ice/mainnet-deployment-03-12-2020/contracts/interfaces/ILendingPool.sol
interface ILendingPool {
    /// @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
    /// - E.g. User deposits 100 USDC and gets in return 100 aUSDC
    /// @param asset The address of the underlying asset to deposit
    /// @param amount The amount to be deposited
    /// @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
    ///   wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
    ///   is a different wallet
    function deposit(
        address asset,
        uint amount,
        address onBehalfOf,
        uint16 /*referralCode*/
    ) external;

    /// @dev Returns the normalized income normalized income of the reserve
    /// @param asset The address of the underlying asset of the reserve
    /// @return The reserve's normalized income
    function getReserveNormalizedIncome(address asset) external view returns (uint256);
}
