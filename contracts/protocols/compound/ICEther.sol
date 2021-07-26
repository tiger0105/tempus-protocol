// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ICToken.sol";

interface ICEther is ICToken {
    function mint() external payable;
}
