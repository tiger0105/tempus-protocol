// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./IPriceOracle.sol";
import "./protocols/lido/ILido.sol";

contract StETHPriceOracle is IPriceOracle {
    function underlyingProtocol() external pure override returns (bytes32) {
        return "Lido";
    }

    /// @return Current interest rate of the StETH contract
    function currentInterestRate(address token) external view override returns (uint256) {
        // NOTE: if totalSupply() is 0, then rate is also 0,
        //       but this only happens right after deploy, so we ignore it
        return ILido(token).getSharesByPooledEth(1e18);
    }

    /// NOTE: Lido StETH is pegged 1:1 to ETH
    /// @return Asset Token amount
    function numAssetsPerYieldToken(address, uint256 yieldBearingAmount) external pure override returns (uint256) {
        return yieldBearingAmount;
    }

    /// NOTE: Lido StETH is pegged 1:1 to ETH
    /// @return YBT amount
    function numYieldTokensPerAsset(address, uint256 backingTokenAmount) external pure override returns (uint256) {
        return backingTokenAmount;
    }
}
