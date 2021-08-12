// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/compound/ICToken.sol";
import "./math/FixedPoint18.sol";

contract CompoundPriceOracle is IPriceOracle {
    using FixedPoint18 for uint256;

    function underlyingProtocol() external pure override returns (bytes32) {
        return "Compound";
    }

    /// @return Current Interest Rate as a 1e18 decimal
    function currentInterestRate(address token) external view override returns (uint256) {
        return ICToken(token).exchangeRateStored();
    }

    function numAssetsPerYieldToken(address token, uint256 amount) external view override returns (uint256) {
        return this.currentInterestRate(token).mul(amount);
    }

    function numYieldTokensPerAsset(address t, uint256 amount) external view override returns (uint256) {
        return amount.div(this.currentInterestRate(t));
    }
}
