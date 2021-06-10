// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20OwnerMintableToken is ERC20 {
    /// The manager who is allowed to mint and burn.
    address public manager;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        manager = msg.sender;
    }

    /// @param account Recipient address to mint tokens to
    /// @param amount Number of tokens to mint
    function mint(address account, uint256 amount) public {
        require(msg.sender == manager);
        _mint(account, amount);
    }

    /// @param account Source address to burn tokens from
    /// @param amount Number of tokens to burn
    function burn(address account, uint256 amount) public {
        require(msg.sender == manager);
        _burn(account, amount);
    }
}
