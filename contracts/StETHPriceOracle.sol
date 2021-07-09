// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./mocks/lido/ILido.sol";

contract StETHPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view override returns (uint256) {
        ILido steth = ILido(token);
        uint totalSupply = steth.totalSupply();
        if (totalSupply == 0) {
            return 1e18; // 1 WAD
        } else {
            return (steth.getTotalShares() * 1e18) / totalSupply;
        }
    }
}
