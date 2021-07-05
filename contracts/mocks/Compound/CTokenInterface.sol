// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

abstract contract CTokenInterface {
    // as defined in Compound's CTokenInterfaces.sol
    function exchangeRateCurrent() public view virtual returns (uint);
}
