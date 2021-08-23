// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import "./IVault.sol";
import "./../../ITempusPool.sol";

interface ITempusAMM {
    function getVault() external view returns (IVault);

    function getPoolId() external view returns (bytes32);

    function tempusPool() external view returns (ITempusPool);
}
