// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ITokenPairPriceFeed.sol";
import "../TempusPool.sol";
import "./ChainlinkTokenPairPriceFeed/ChainlinkTokenPairPriceFeed.sol";
import "../math/FixedPoint18.sol";

contract Stats is ITokenPairPriceFeed, ChainlinkTokenPairPriceFeed {
    using FixedPoint18 for uint256;

    // TODO: use ITempusPool interface instead of TempusPool when the 'principalShare' property is added to the interface
    /// @param pool The TempusPool to fetch its TVL (total value locked)
    /// @return total value locked of a TempusPool (denominated in BackingTokens)
    function totalValueLockedInBackingTokens(TempusPool pool) public view returns (uint256) {
        uint256 principalShareTotalSupply = pool.principalShare().totalSupply();
        uint256 yieldShareTotalSupply = pool.yieldShare().totalSupply();
        // TODO: this assumption that TPS price is always 1e18 is only correct with the current implementation of pricePerPoolShare which is probably not good
        uint256 pricePerPrincipalShare = 1e18;
        uint256 pricePerYieldShare = pool.pricePerYieldShare();

        return
            calculateTvlInBackingTokens(
                principalShareTotalSupply,
                yieldShareTotalSupply,
                pricePerPrincipalShare,
                pricePerYieldShare
            );
    }

    /// @param pool The TempusPool to fetch its TVL (total value locked)
    /// @param rateConversionData ENS nameHash of the ENS name of a Chainlink price aggregator (e.g. - the ENS nameHash of 'eth-usd.data.eth')
    /// @return total value locked of a TempusPool (denominated in the rate of the provided token pair)
    function totalValueLockedAtGivenRate(TempusPool pool, bytes32 rateConversionData) external view returns (uint256) {
        uint256 tvlInBackingTokens = totalValueLockedInBackingTokens(pool);

        (uint256 rate, uint256 rateDenominator) = getRate(rateConversionData);
        return (tvlInBackingTokens * rate) / rateDenominator;
    }

    function calculateTvlInBackingTokens(
        uint256 totalSupplyTPS,
        uint256 totalSupplyTYS,
        uint256 pricePerPrincipalShare,
        uint256 pricePerYieldShare
    ) internal pure returns (uint256) {
        return totalSupplyTPS.mulf18(pricePerPrincipalShare) + totalSupplyTYS.mulf18(pricePerYieldShare);
    }
}
