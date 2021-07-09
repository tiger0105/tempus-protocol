// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/lido/ILido.sol";

contract StETHPriceOracle is IPriceOracle {
    /// @return Current exchange rate as a 1e18 decimal
    function currentRate(address token) external view override returns (uint256) {
        ILido steth = ILido(token);
        uint totalSupply = steth.totalSupply();
        if (totalSupply == 0) {
            return 1e18;
        } else {
            return (steth.getTotalShares() * 1e18) / totalSupply;
        }
    }
}
