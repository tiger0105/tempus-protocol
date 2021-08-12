// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import "./IVault.sol";

interface ITempusAMM {
    function getVault() external view returns (IVault);

    function getPoolId() external view returns (bytes32);
}
