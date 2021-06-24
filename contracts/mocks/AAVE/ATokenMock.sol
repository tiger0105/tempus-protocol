// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;
import "./../../token/ERC20OwnerMintableToken.sol";

/// Yield Bearing Token for AAVE - AToken
contract ATokenMock is ERC20OwnerMintableToken {
    // solhint-disable-next-line no-empty-blocks
    constructor(string memory name, string memory symbol) ERC20OwnerMintableToken(name, symbol) {}
}
