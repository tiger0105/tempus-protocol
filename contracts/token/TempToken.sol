// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TempToken is ERC20("Tempus", "TEMP") {
    /// TEMP Token constructor, implemented as a fixed supply
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) {
        _mint(msg.sender, totalTokenSupply);
    }
}
