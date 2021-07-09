// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

interface IPriceOracle {
    /// This returns the current exchange rate of the yield bearing instrument compared
    /// to the backing instrument.
    ///
    /// @param token The address of the appropraite contract for the protocol.
    /// e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a 1e18 decimal
    function currentRate(address token) external view returns (uint256);
}
