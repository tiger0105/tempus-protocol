// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TempusToken is ERC20 {
    /// TEMP Token constructor, implemented as a fixed supply
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) ERC20("Tempus", "TEMP") {
        _mint(msg.sender, totalTokenSupply);
    }
}
