// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

import "./ITempusPool.sol";

/// @author The tempus.finance team
/// @title Implementation of Tempus Pool
contract TempusPool is ITempusPool {
    address public override underlyingToken;

    uint256 public override startTime;
    uint256 public override maturityTime;

    /// Constructs Pool with underlying token, start and maturity date
    /// @param token underlying collateral token
    /// @param start start time of this pool
    /// @param maturity maturity time of this pool
    constructor(
        address token,
        uint256 start,
        uint256 maturity
    ) {
        underlyingToken = token;
        startTime = start;
        maturityTime = maturity;
    }

    // solhint-disable-next-line no-empty-blocks
    function deposit(uint256 tokenAmount) public override {}
}
