// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ITempusPoolFactory.sol";
import "./../pools/AaveTempusPool.sol";

/// @author The tempus.finance team
/// @title Implementation of Aave Tempus Pool Factory
contract AaveTempusPoolFactory is ITempusPoolFactory {
    bytes32 public constant override protocol = "Aave";

    /// Constructs Aave Pool with underlying token, start and maturity date
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
    ) external override returns (ITempusPool) {
        AaveTempusPool aavePool = new AaveTempusPool(
            IAToken(token),
            maturity,
            estYield,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol
        );
        return ITempusPool(aavePool);
    }
}
