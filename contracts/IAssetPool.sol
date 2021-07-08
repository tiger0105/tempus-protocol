// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

/// @author The tempus.finance team
/// @title Interface for underlying asset pool deposit mechanisms
interface IAssetPool {
    /// @return The address of the Yield Bearing Token contract.
    function yieldToken() external returns (address);

    /// @dev Deposits X amount of backing tokens from sender into the pool
    /// @param onBehalfOf ERC20 Address which will receive the Yield Bearing Tokens
    /// @param amount Amount of backing tokens, such as ETH or DAI to deposit
    function depositAsset(address onBehalfOf, uint amount) external;

    /// @dev The current exchange rate of the yield bearing instrument compared
    ///      to the backing instrument. e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate() external view returns (uint);
}
