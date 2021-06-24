// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ERC20FixedSupply.sol";

contract TempusToken is ERC20FixedSupply {
    /// TEMP Token constructor, implemented as a fixed supply
    /// @param totalTokenSupply total supply of the token, initially awarded to msg.sender
    constructor(uint256 totalTokenSupply) ERC20FixedSupply("Tempus", "TEMP", totalTokenSupply) {
    }
}
