// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

pragma abicoder v2;

import "@balancer-labs/v2-pool-weighted/contracts/WeightedPool2TokensFactory.sol";
import "./TempusAMM.sol";
import "./TempusVault.sol";

contract TempusAMMFactory is WeightedPool2TokensFactory {
    constructor(TempusVault vault) WeightedPool2TokensFactory(vault) {
        // solhint-disable-previous-line no-empty-blocks
    }
}
