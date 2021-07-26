// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/compound/ICToken.sol";

contract CompoundPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view override returns (uint256) {
        // TODO: change this to use exchangeRateCurrent() to avoid unwanted arbitrage
        return ICToken(token).exchangeRateStored();
    }
}
