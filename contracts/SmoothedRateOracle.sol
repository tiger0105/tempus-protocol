// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./math/Fixed256xVar.sol";

abstract contract SmoothedRateOracle {
    using Fixed256xVar for uint256;

    /// TODO: IMPORTANT use struct and try to fit
    ///     latestSmoothedRate, latestTrend & latestSmoothedRateSampleTimestamp in 1-2 storage slots instead of 3
    /// Note - this will require checking if smaller variables than uint256 can be used (prolly yeah)
    uint256 internal latestSmoothedRate;
    uint256 internal latestTrend;
    uint256 internal latestSmoothedRateSampleTimestamp;

    /// TODO: IMPORTANT these need to be optimized.
    // Hyperparams
    uint256 private constant LEVEL_SMOOTHING_MULTIPLIER = 10;
    uint256 private constant TREND_SMOOTHING_MULTIPLIER = 10;
    uint256 private constant HYPER_PARAMS_DENOMINATOR = 100;
    uint256 private constant EMA_SAMPLE_PERIOD = 4 hours;

    event SmoothedRateUpdated(uint256 smoothedRate);

    constructor(uint256 initialSmoothedRate, uint256 initialTrend) {
        setSmoothedRate(initialSmoothedRate, initialTrend);
    }

    function updateSmoothedRate(uint256 latestRate) internal {
        uint256 timeElapsedSinceLastSample = block.timestamp - latestSmoothedRateSampleTimestamp;
        if (timeElapsedSinceLastSample >= EMA_SAMPLE_PERIOD) {

            /// TODO: IMPORTANT is this necessary? I don't think so ser
            /// ADJUSTED = m * LEVEL_SMOOTHING_MULTIPLIER
            /// OR ADJUSTED = LEVEL_SMOOTHING_MULTIPLIER ** m 
            // uint256 adjustedLevelSmoothingMultiplier = LEVEL_SMOOTHING_MULTIPLIER +
            //     LEVEL_SMOOTHING_MULTIPLIER.mulfV(timeElapsedSinceLastSample, EMA_SAMPLE_PERIOD); /// TODO: IMPORTANT Should this normalization be done ?
            // uint256 adjustedTrendSmoothingMultiplier = TREND_SMOOTHING_MULTIPLIER +
            //     TREND_SMOOTHING_MULTIPLIER.mulfV(timeElapsedSinceLastSample, EMA_SAMPLE_PERIOD);
            
            uint256 level =
                latestSmoothedRate.mulfV(LEVEL_SMOOTHING_MULTIPLIER, HYPER_PARAMS_DENOMINATOR) +
                (latestRate + latestTrend).mulfV(
                    HYPER_PARAMS_DENOMINATOR - LEVEL_SMOOTHING_MULTIPLIER,
                    HYPER_PARAMS_DENOMINATOR
                );
            // uint256 trend = (level - latestSmoothedRate).mulfV(TREND_SMOOTHING_MULTIPLIER, HYPER_PARAMS_DENOMINATOR) + 
            //     (latestTrend).mulfV(
            //         HYPER_PARAMS_DENOMINATOR - TREND_SMOOTHING_MULTIPLIER,
            //         HYPER_PARAMS_DENOMINATOR
            //     );
            uint256 trend = (level - latestSmoothedRate).mulfV(EMA_SAMPLE_PERIOD, timeElapsedSinceLastSample)
                .mulfV(TREND_SMOOTHING_MULTIPLIER, HYPER_PARAMS_DENOMINATOR) + 
                (latestTrend).mulfV(
                    HYPER_PARAMS_DENOMINATOR - TREND_SMOOTHING_MULTIPLIER,
                    HYPER_PARAMS_DENOMINATOR
                );

            setSmoothedRate(level, trend); 
            // emit SmoothedRateUpdated(ema);
        }
    }

    /// F[t+m] = S[t] + m * B(t)
    function forecastInterestAtTimestamp(uint256 timestamp) internal view returns (uint256) {
        return latestSmoothedRate +
            (timestamp - latestSmoothedRateSampleTimestamp).mulfV(latestTrend, EMA_SAMPLE_PERIOD);
    }

    function setSmoothedRate(uint256 smoothedRate, uint256 trend) private {
        latestSmoothedRate = smoothedRate;
        latestTrend = trend;
        latestSmoothedRateSampleTimestamp = block.timestamp;
    }
}
