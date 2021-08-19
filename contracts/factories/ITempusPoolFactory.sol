// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./../ITempusPool.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool Factory
interface ITempusPoolFactory {
    /// @return name of the underlying protocol for factory
    function protocol() external view returns (bytes32);

    /// Constructs Pool with underlying token, start and maturity date
    /// @param token underlying yield bearing token
    /// @param maturity maturity time of this pool
    /// @param estYield estimated yield for the lifetime of the pool
    /// @param principalName name of principal share
    /// @param principalSymbol symbol of principal share
    /// @param yieldName name of yield share
    /// @param yieldSymbol symbol of yield share
    function deployPool(
        address token,
        uint256 maturity,
        uint256 estYield,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    ) external returns (ITempusPool);
}
