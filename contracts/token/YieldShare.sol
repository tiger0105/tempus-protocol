// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ERC20OwnerMintableToken.sol";

/// @dev Token representing the yield shares of a pool.
contract YieldShare is ERC20OwnerMintableToken {
    // solhint-disable-next-line no-empty-blocks
    constructor(string memory name, string memory symbol) ERC20OwnerMintableToken(name, symbol) {}
}
