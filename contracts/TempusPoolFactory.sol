// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./TempusPool.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPoolFactory {
    /// Constructs Pool with underlying token, start and maturity date
    /// @param token underlying yield bearing token
    /// @param oracle the price oracle correspoding to the token
    /// @param maturity maturity time of this pool
    function deployPool(
        address token,
        IPriceOracle oracle,
        uint256 maturity,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    ) external returns (ITempusPool) {
        return ITempusPool(new TempusPool(token, oracle, maturity, pricipalName, principalSymbol, yieldName, yieldSymbol));
    }
}
