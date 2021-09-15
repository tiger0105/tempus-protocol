// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";

/// Tempus Token with a fixed supply and holders having the ability to burn their own tokens.
contract TempusToken is ERC20PresetFixedSupply, ERC20Snapshot {
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) ERC20PresetFixedSupply("Tempus", "TEMP", totalTokenSupply, msg.sender) {}

    // Here we need to specify the order of inheritance.
    // ERC20Burnable is the trait imported by ERC20PresetFixedSupply.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Snapshot) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
