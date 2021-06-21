// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./mocks/AAVE/IAToken.sol";

contract AavePriceOracle is IPriceOracle {
    function currentRate(address token) external view override returns (uint256) {
        IAToken atoken = IAToken(token);
        return atoken.POOL().getReserveNormalizedIncome(atoken.UNDERLYING_ASSET_ADDRESS());
    }
}
