// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/Vault.sol";
import "./TempusAuthorizer.sol";

contract TempusVault is Vault {
    constructor(
        TempusAuthorizer authorizer,
        IWETH weth,
        uint256 pauseWindowDuration,
        uint256 bufferPeriodDuration
    ) Vault(authorizer, weth, pauseWindowDuration, bufferPeriodDuration) {
        // solhint-disable-previous-line no-empty-blocks
    }
}
