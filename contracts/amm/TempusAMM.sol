// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

pragma abicoder v2;

import "@balancer-labs/v2-pool-weighted/contracts/WeightedPool2Tokens.sol";

contract TempusAMM is WeightedPool2Tokens {
    constructor(NewPoolParams memory params) WeightedPool2Tokens(params) {
        // solhint-disable-previous-line no-empty-blocks
    }
}
