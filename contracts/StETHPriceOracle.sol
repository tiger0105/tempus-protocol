// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./mocks/lido/StETH.sol";

contract StETHPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view override returns (uint256) {
        StETH steth = StETH(token);
        return (steth.getTotalShares() * 1e18) / steth.totalSupply();
    }
}
