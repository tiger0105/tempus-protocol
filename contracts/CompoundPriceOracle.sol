// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./mocks/Compound/CTokenInterface.sol";
import "./IPriceOracle.sol";

contract CompoundPriceOracle is IPriceOracle {
    function currentRate(address token) external view override returns (uint256) {
        CTokenInterface cToken = CTokenInterface(token);
        return cToken.exchangeRateCurrent();
    }
}
