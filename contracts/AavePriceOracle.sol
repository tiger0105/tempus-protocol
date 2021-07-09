// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./mocks/aave/IAToken.sol";

contract AavePriceOracle is IPriceOracle {
    /// @return Current exchange rate as a 1e18 decimal
    function currentRate(address token) external view override returns (uint256) {
        IAToken atoken = IAToken(token);
        uint rateInRay = atoken.POOL().getReserveNormalizedIncome(atoken.UNDERLYING_ASSET_ADDRESS());
        // convert from RAY 1e27 to WAD 1e18 decimal
        return rateInRay / 1e9;
    }
}
