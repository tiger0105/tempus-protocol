// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/aave/IAToken.sol";

contract AavePriceOracle is IPriceOracle {
    function underlyingProtocol() external pure override returns (bytes32) {
        return "Aave";
    }

    /// @return Current Interest Rate as a 1e18 decimal
    function currentInterestRate(address token) external view override returns (uint256) {
        IAToken atoken = IAToken(token);
        uint rateInRay = atoken.POOL().getReserveNormalizedIncome(atoken.UNDERLYING_ASSET_ADDRESS());
        // convert from RAY 1e27 to WAD 1e18 decimal
        return rateInRay / 1e9;
    }

    /// NOTE: Aave AToken is pegged 1:1 with backing token
    function numAssetsPerYieldToken(address, uint256 amount) external pure override returns (uint256) {
        return amount;
    }

    /// NOTE: Aave AToken is pegged 1:1 with backing token
    function numYieldTokensPerAsset(address, uint256 amount) external pure override returns (uint256) {
        return amount;
    }
}
