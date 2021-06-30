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
    function startTime() external returns (uint256);

    /// @return Maturity time of the pool.
    function maturityTime() external returns (uint256);

    /// Deposit funds to the pool.
    /// @param tokenAmount Amount of collateral user wants to deposit to mint principal and interest token.
    function deposit(uint256 tokenAmount) external;

    /// The current exchange rate of yield bearing token versus its backing.
    /// @return The rate.
    function currentExchangeRate() external view returns (uint256);
}
