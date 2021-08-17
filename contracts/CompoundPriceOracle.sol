// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/compound/ICToken.sol";
import "./math/Fixed256x18.sol";

contract CompoundPriceOracle is IPriceOracle {
    using Fixed256x18 for uint256;

    function protocolName() external pure override returns (bytes32) {
        return "Compound";
    }

    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate(address token) external override returns (uint256) {
        // NOTE: exchangeRateCurrent() will accrue interest and gets the latest Interest Rate
        //       We do this to avoid arbitrage
        return ICToken(token).exchangeRateCurrent();
    }

    /// @return Current Interest Rate as an 1e18 decimal
    function storedInterestRate(address token) external view override returns (uint256) {
        return ICToken(token).exchangeRateStored();
    }

    function numAssetsPerYieldToken(uint256 amount, uint256 rate) external pure override returns (uint256) {
        return rate.mulf18(amount);
    }

    function numYieldTokensPerAsset(uint256 amount, uint256 rate) external pure override returns (uint256) {
        return amount.divf18(rate);
    }
}
