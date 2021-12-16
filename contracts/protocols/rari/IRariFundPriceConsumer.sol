// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.10;

/***
    @notice based on https://github.com/Rari-Capital/rari-stable-pool-contracts/blob/386aa8811e7f12c2908066ae17af923758503739/contracts/RariFundPriceConsumer.sol
 */
interface IRariFundPriceConsumer {
    function getCurrencyPricesInUsd() external view returns (uint256[] memory);
}
