// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

/// @author The tempus.finance team
/// @title A simple interface that tempus pools will be implementing
abstract contract ITempusPool {
    /// @return  underlying collateral token
    /// @dev this token will be used as a token that user can deposit to mint same amounts
    /// of principal and interest token
    function underlyingToken() external virtual returns (address);

    /// @return start time of the pool
    function startTime() external virtual returns (uint256);

    /// @return maturity time of the pool
    function maturityTime() external virtual returns (uint256);

    /// Deposit funds to the pool
    /// @param tokenAmount amount of collateral user wants to deposit to mint principal and interest token
    function deposit(uint256 tokenAmount) public virtual;
}
