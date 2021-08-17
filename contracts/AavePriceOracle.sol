// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/aave/IAToken.sol";

contract AavePriceOracle is IPriceOracle {
    function protocolName() external pure override returns (bytes32) {
        return "Aave";
    }

    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate(address token) external view override returns (uint256) {
        return this.storedInterestRate(token);
    }

    /// @return Stored Interest Rate as an 1e18 decimal
    function storedInterestRate(address token) external view override returns (uint256) {
        IAToken atoken = IAToken(token);
        uint rateInRay = atoken.POOL().getReserveNormalizedIncome(atoken.UNDERLYING_ASSET_ADDRESS());
        // convert from RAY 1e27 to WAD 1e18 decimal
        return rateInRay / 1e9;
    }

    /// NOTE: Aave AToken is pegged 1:1 with backing token
    function numAssetsPerYieldToken(uint256 yieldBearingAmount, uint256) external pure override returns (uint256) {
        return yieldBearingAmount;
    }

    /// NOTE: Aave AToken is pegged 1:1 with backing token
    function numYieldTokensPerAsset(uint256 backingTokenAmount, uint256) external pure override returns (uint256) {
        return backingTokenAmount;
    }
}
