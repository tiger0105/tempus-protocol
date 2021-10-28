// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/// Tempus Token with a fixed supply and holders having the ability to burn their own tokens.
contract TempusToken is ERC20Votes {
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) ERC20("Tempus", "TEMP") ERC20Permit("Tempus") {
        _mint(msg.sender, totalTokenSupply);
    }

    /// Destroys `amount` tokens from the caller.
    /// @param amount Number of tokens to burn.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
