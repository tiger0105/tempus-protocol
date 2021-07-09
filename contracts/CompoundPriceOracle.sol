// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./mocks/compound/CTokenInterfaces.sol";
import "./IPriceOracle.sol";

contract CompoundPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a 1e18 decimal
    function currentRate(address token) external view override returns (uint256) {
        // TODO: change this to use exchangeRateCurrent() to avoid unwanted arbitrage
        return CTokenInterface(token).exchangeRateStored();
    }
}
