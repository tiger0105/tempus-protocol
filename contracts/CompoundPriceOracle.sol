// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./mocks/Compound/CTokenInterface.sol";
import "./IPriceOracle.sol";

contract CompoundPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view override returns (uint256) {
        CTokenInterface cToken = CTokenInterface(token);
        return cToken.exchangeRateCurrent();
    }
}
