// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import "./IPool.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract Pool is IPool {
    address public override underlyingToken;

    uint256 public override startTime;
    uint256 public override maturityTime;

    /// Constructs Pool with underlying token, start and maturity date 
    /// @param token underlying collateral token
    /// @param start start time of this pool
    /// @param maturity maturity time of this pool
    constructor(address token, uint256 start, uint256 maturity) {
        underlyingToken = token;
        startTime = start;
        maturityTime = maturity;
    }

    function deposit(uint256 tokenAmount) public override {
    }
}