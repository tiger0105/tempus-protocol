// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

interface IPriceOracle {
    /// This returns the current exchange rate of the yield bearing instrument compared
    /// to the backing instrument.
    ///
    /// @param token The address of the appropraite contract for the protocol.
    /// e.g it is an AToken in case of AAVE.
    /// @return Current exchange rate as a WAD decimal
    function currentRate(address token) external view returns (uint256);

    /// This returns actual backing token amount for amount of yield bearing tokens
    /// For example, in case of aave result is amount, and for compound is amount * currentRate()
    /// @param token The address of the appropriate contract for yield token
    /// @param amount Amount of yield bearing tokens
    /// @return Scaled balance to express value of @param amount yield tokens in backing token
    function scaledBalance(address token, uint256 amount) external view returns (uint256);
}
