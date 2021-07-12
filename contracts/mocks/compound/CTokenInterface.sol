// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

interface CTokenInterface {
    // as defined in Compound's CTokenInterfaces.sol
    function exchangeRateCurrent() external view returns (uint);
}
