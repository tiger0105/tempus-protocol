// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

pragma abicoder v2;

import "@balancer-labs/v2-vault/contracts/Authorizer.sol";

contract TempusAuthorizer is Authorizer {
    constructor() Authorizer(msg.sender) {
        // solhint-disable-previous-line no-empty-blocks
    }
}
