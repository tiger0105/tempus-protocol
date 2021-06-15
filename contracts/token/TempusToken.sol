// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TempusToken is ERC20("Tempus", "TEMP") {
    /// TEMP Token constructor, implemented as a fixed supply
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) {
        _mint(msg.sender, totalTokenSupply);
    }
}
