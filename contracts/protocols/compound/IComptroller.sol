// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

// This is based on https://github.com/compound-finance/compound-protocol/contracts-ComptrollerInterface.sol
interface IComptroller {
    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory);
}
