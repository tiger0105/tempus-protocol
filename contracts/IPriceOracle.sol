// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

interface IPriceOracle {
    /// @dev This returns the name of the underlying protocol
    /// @return The name of underlying protocol, for example "Aave" for Aave protocol
    function protocolName() external pure returns (bytes32);

    /// @dev This updates the underlying pool's interest rate
    ///      It should be done first thing before deposit/redeem to avoid arbitrage
    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate(address token) external returns (uint256);

    /// @dev This returns the stored Interest Rate of the YBT (Yield Bearing Token) pool
    ///      it is safe to call this after updateInterestRate() was called
    /// @param token The address of the YBT protocol
    /// e.g it is an AToken in case of Aave, CToken in case of Compound, StETH in case of Lido
    /// @return Stored Interest Rate as an 1e18 decimal
    function storedInterestRate(address token) external view returns (uint256);

    /// @dev This returns actual Backing Token amount for amount of YBT (Yield Bearing Tokens)
    ///      For example, in case of Aave and Lido the result is 1:1,
    ///      and for compound is `yieldBearingAmount * currentInterestRate()`
    /// @param yieldBearingAmount Amount of YBT
    /// @param interestRate The current interest rate
    /// @return Amount of Backing Tokens for specified @param yieldBearingAmount
    function numAssetsPerYieldToken(uint256 yieldBearingAmount, uint256 interestRate) external pure returns (uint256);

    /// @dev This returns amount of YBT (Yield Bearing Tokens) that can be converted
    ///      from @param backingTokenAmount Backing Tokens
    /// @param backingTokenAmount Amount of Backing Tokens
    /// @param interestRate The current interest rate
    /// @return Amount of YBT for specified @param backingTokenAmount
    function numYieldTokensPerAsset(uint256 backingTokenAmount, uint256 interestRate) external view returns (uint256);
}
