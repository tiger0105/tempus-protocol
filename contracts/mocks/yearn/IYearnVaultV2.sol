// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

/***
    @notice based on https://github.com/yearn/yearn-vaults/blob/main/contracts/Vault.vy
 */
interface IYearnVaultV2 {
    /// @dev Deposits an `amount` of underlying asset into the Vault, receiving in return overlying yTokens.
    /// - E.g. User deposits 100 DAI and gets in return 100 yDAI
    /// @param amount The amount to be deposited
    function deposit(uint256 amount) external;

    /// @dev Returns the current price of a share of the Vault
    /// @return The price of a share of the Vault
    function pricePerShare() external view returns (uint256);

    /** @notice
        Returns the total quantity of all assets under control of this
        Vault, whether they're loaned out to a Strategy, or currently held in
        the Vault.
    @return The total assets under control of this Vault.
    */
    function totalAssets() external view returns (uint256);
}
