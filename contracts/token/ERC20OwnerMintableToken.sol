// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// This is a simplified implementation, but compatible with
/// OpenZeppelin's ERC20Mintable and ERC20Burnable extensions.
contract ERC20OwnerMintableToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    /// Creates `amount` new tokens for `to`.
    /// @param account Recipient address to mint tokens to
    /// @param amount Number of tokens to mint
    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    /// Destroys `amount` tokens from the caller.
    /// @param amount Number of tokens to burn.
    function burn(uint256 amount) external onlyOwner {
        _burn(msg.sender, amount);
    }

    /// Destroys `amount` tokens from `account`.
    /// @param account Source address to burn tokens from
    /// @param amount Number of tokens to burn
    function burnFrom(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }
}
