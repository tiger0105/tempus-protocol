// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

/// @author The tempus.finance team
/// @title Interface for underlying asset pool deposit mechanisms
interface IAssetPool {
    /// @return The address of the Yield Bearing Token contract.
    function yieldToken() external returns (address);

    /// @dev This can be used for approve() before depositAsset()
    /// @return The address of the underlying pool which transfers deposits
    function pool() external returns (address);

    /// @dev Deposits X amount of backing tokens from `msg.sender` into the pool
    ///      msg.sender must first approve transfer to this `yieldToken` address
    /// @param recipient ERC20 Address which will receive the Yield Bearing Tokens
    /// @param amount Amount of backing tokens, such as ETH or DAI to deposit
    /// @return Number of Yield Bearing Tokens minted to `recipient`
    function depositAsset(address recipient, uint amount) external returns (uint);

    /// @dev The current exchange rate of the yield bearing instrument compared
    ///      to the backing instrument. e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate() external view returns (uint);
}
