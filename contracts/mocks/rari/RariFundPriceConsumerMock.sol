// solhint-disable

// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../protocols/rari/IRariFundPriceConsumer.sol";

contract RariFundPriceConsumerMock is IRariFundPriceConsumer {
    uint256[] internal prices;

    constructor(uint256 currenciesCount) {
        prices = new uint256[](currenciesCount);
        for (uint256 i; i < prices.length; i++) {
            prices[i] = 1e18;
        }
    }

    function getCurrencyPricesInUsd() external view returns (uint256[] memory) {
        return prices;
    }

    /// Mock function
    function setCurrencyPriceInUsd(uint256 currencyIndex, uint256 price) external {
        prices[currencyIndex] = price;
    }
}
