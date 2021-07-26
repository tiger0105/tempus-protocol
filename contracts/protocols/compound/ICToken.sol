// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IComptroller.sol";

interface ICToken is IERC20 {
    function isCToken() external view returns (bool);

    function comptroller() external view returns (IComptroller);

    function exchangeRateCurrent() external returns (uint);

    function exchangeRateStored() external view returns (uint);
}
