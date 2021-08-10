// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/lido/ILido.sol";

contract StETHPriceOracle is IPriceOracle {
    /// @return Current exchange rate of StETH as a 1e18 decimal
    function currentRate(address token) external view override returns (uint256) {
        // NOTE: if totalSupply() is 0, then rate is also 0,
        //       but this only happens right after deploy, so we ignore it
        return ILido(token).getSharesByPooledEth(1e18);
    }

    function scaledBalance(address token, uint256 amount) external view override returns (uint256) {
        return ILido(token).getPooledEthByShares(amount);
    }

    function numYieldTokensPerAsset(address token, uint256 amount) external view override returns (uint256) {
        return ILido(token).getSharesByPooledEth(amount);
    }
}
