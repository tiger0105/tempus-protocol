// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "../math/Fixed256x18.sol";

library AMMBalancesHelper {
    using Fixed256x18 for uint256;

    function getLiquidityProvisionSharesAmounts(
        uint256[] memory ammBalances,
        uint256 shares
    ) internal pure returns (uint256[] memory) {
        uint256[2] memory ammDepositPercentages = getAMMBalancesRatio(ammBalances);
        uint256[] memory ammLiquidityProvisionAmounts = new uint256[](2);

        (ammLiquidityProvisionAmounts[0], ammLiquidityProvisionAmounts[1]) = (
            shares.mulf18(ammDepositPercentages[0]),
            shares.mulf18(ammDepositPercentages[1])
        );
        
        return ammLiquidityProvisionAmounts;
    }

    function getAMMBalancesRatio(uint256[] memory ammBalances) internal pure returns (uint256[2] memory balancesRatio) {
        uint256 rate = ammBalances[0].divf18(ammBalances[1]);

        (balancesRatio[0], balancesRatio[1]) = rate > Fixed256x18.ONE
            ? (Fixed256x18.ONE, Fixed256x18.ONE.divf18(rate))
            : (rate, Fixed256x18.ONE);
    }
}