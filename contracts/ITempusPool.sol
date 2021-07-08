// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

/// @author The tempus.finance team
/// @title The interface of a Tempus Pool
interface ITempusPool {
    /// @return The version of the pool.
    function version() external returns (uint);

    /// @return The underlying yield bearing token.
    /// @dev This token will be used as a token that user can deposit to mint same amounts
    /// of principal and interest shares.
    function yieldBearingToken() external returns (address);

    // TODO: expose principalShare and yieldShare

    /// @return Start time of the pool.
    function startTime() external returns (uint);

    /// @return Maturity time of the pool.
    function maturityTime() external returns (uint);

    /// @dev Deposits yield bearing tokens (such as cDAI) into tempus pool
    /// @param onBehalfOf Address whichs holds the depositable Yield Bearing Tokens and
    ///                   will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    ///                   This account must approve() tokenAmount to this Tempus Pool
    /// @param yieldTokenAmount Number of yield bearing tokens to deposit
    function deposit(address onBehalfOf, uint yieldTokenAmount) external;

    /// @dev Deposits asset tokens (such as DAI or ETH) into tempus pool on behalf of sender
    /// @param assetTokenAmount Number of asset tokens to deposit
    function depositAsset(uint assetTokenAmount) external;

    /// The current exchange rate of yield bearing token versus its backing.
    /// @return The rate.
    function currentExchangeRate() external view returns (uint);
}
