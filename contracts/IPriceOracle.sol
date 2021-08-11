// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

interface IPriceOracle {
    /// @dev This returns the name of the underlying protocol
    /// @return The name of underlying protocol, for example "Aave" for Aave protocol
    function underlyingProtocol() external pure returns (bytes32);

    /// @dev This returns the current Interest Rate of the YBT (Yield Bearing Token) pool
    /// @param token The address of the YBT protocol
    /// e.g it is an AToken in case of Aave, CToken in case of Compound, StETH in case of Lido
    /// @return Current Interest Rate as a 1e18 decimal
    function currentInterestRate(address token) external view returns (uint256);

    /// @dev This returns actual Backing Token amount for amount of YBT (Yield Bearing Tokens)
    ///      For example, in case of Aave and Lido the result is 1:1,
    ///      and for compound is `yieldBearingAmount * currentInterestRate()`
    /// @param token The address of the YBT protocol
    /// @param yieldBearingAmount Amount of YBT
    /// @return Amount of Backing Tokens for specified @param yieldBearingAmount
    function numAssetsPerYieldToken(address token, uint256 yieldBearingAmount) external view returns (uint256);

    /// @dev This returns amount of YBT (Yield Bearing Tokens) that can be converted
    ///      from @param backingTokenAmount Backing Tokens
    /// @param token The address of the YBT protocol
    /// @param backingTokenAmount Amount of Backing Tokens
    /// @return Amount of YBT for specified @param backingTokenAmount
    function numYieldTokensPerAsset(address token, uint256 backingTokenAmount) external view returns (uint256);
}
