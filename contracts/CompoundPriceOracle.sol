// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/compound/ICToken.sol";

contract CompoundPriceOracle is IPriceOracle {
    /// @return Current Interest Rate as a 1e18 decimal
    function currentInterestRate(address token) external view override returns (uint256) {
        return ICToken(token).exchangeRateStored();
    }

    function numAssetsPerYieldToken(address token, uint256 amount) external view override returns (uint256) {
        return (amount * this.currentInterestRate(token)) / 1e18;
    }

    function numYieldTokensPerAsset(address t, uint256 amount) external view override returns (uint256) {
        return (amount * 1e18) / this.currentInterestRate(t);
    }
}
