// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./math/Fixed256xVar.sol";

abstract contract RateEMAOracle {
    using Fixed256xVar for uint256;

    /// TODO: IMPORTANT maybe use struct and try to fit
    ///     latestRateEMA & latestEMASampleTimestamp in 1 storage slot to save gas
    uint256 internal latestRateEMA;
    uint256 internal latestEMASampleTimestamp;
    uint256 private constant SMOOTHING_MULTIPLIER = 10;
    uint256 private constant SMOOTHING_MULTIPLIER_DENOMINATOR = 100;
    uint256 private constant EMA_SAMPLE_PERIOD = 4 hours;

    event UpdatedRateEMA(uint256 rateEMA);

    constructor(uint256 initialEMA) {
        setEMA(initialEMA);
    }

    function updateRateEMA(uint256 latestRate) internal {
        uint256 timeElapsedSinceLastSample = block.timestamp - latestEMASampleTimestamp;
        if (timeElapsedSinceLastSample >= EMA_SAMPLE_PERIOD) {
            uint256 adjustedSmoothingMultiplier = SMOOTHING_MULTIPLIER +
                SMOOTHING_MULTIPLIER.mulfV(timeElapsedSinceLastSample, EMA_SAMPLE_PERIOD);
            uint256 ema = latestRateEMA.mulfV(adjustedSmoothingMultiplier, SMOOTHING_MULTIPLIER_DENOMINATOR) +
                latestRate.mulfV(
                    SMOOTHING_MULTIPLIER_DENOMINATOR - adjustedSmoothingMultiplier,
                    SMOOTHING_MULTIPLIER_DENOMINATOR
                );
            setEMA(ema);

            emit UpdatedRateEMA(ema);
        }
    }

    function setEMA(uint256 ema) private {
        latestRateEMA = ema;
        latestEMASampleTimestamp = block.timestamp;
    }
}
