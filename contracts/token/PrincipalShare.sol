// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

import "./ERC20OwnerMintableToken.sol";

/// @dev Token representing the principal shares of a pool.
contract PrincipalShare is ERC20OwnerMintableToken {
    constructor(string memory name, string memory symbol) ERC20OwnerMintableToken(name, symbol) {
        // solhint-disable-next-line no-empty-blocks
    }
}
