// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ICToken.sol";

interface ICErc20 is ICToken {
    function underlying() external view returns (address);
    function mint(uint mintAmount) external returns (uint);
}
