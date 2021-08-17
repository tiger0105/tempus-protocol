// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/lido/ILido.sol";

contract StETHPriceOracle is IPriceOracle {
    function protocolName() external pure override returns (bytes32) {
        return "Lido";
    }

    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate(address token) external view override returns (uint256) {
        return this.storedInterestRate(token);
    }

    // @return Stored Interest Rate as an 1e18 decimal
    function storedInterestRate(address token) external view override returns (uint256) {
        // NOTE: if totalShares() is 0, then rate is also 0,
        //       but this only happens right after deploy, so we ignore it
        return ILido(token).getPooledEthByShares(1e18);
    }

    /// NOTE: Lido StETH is pegged 1:1 to ETH
    /// @return Asset Token amount
    function numAssetsPerYieldToken(uint256 yieldBearingAmount, uint256) external pure override returns (uint256) {
        return yieldBearingAmount;
    }

    /// NOTE: Lido StETH is pegged 1:1 to ETH
    /// @return YBT amount
    function numYieldTokensPerAsset(uint256 backingTokenAmount, uint256) external pure override returns (uint256) {
        return backingTokenAmount;
    }
}
