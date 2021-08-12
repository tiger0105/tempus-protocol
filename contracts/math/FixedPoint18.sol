// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.6;

/// @dev Fixed Point decimal math utils for 18-decimal point precision
library FixedPoint18 {
    /// @dev 1.0 expressed as an 1e18 decimal
    uint256 internal constant ONE = 1e18;

    /// @dev 1e18 decimal precision constant
    uint256 internal constant PRECISION = 1e18;

    /// @dev Multiplies two 1e18 fixed point decimal numbers
    /// @return result = a * b
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // TODO: should we add rounding rules?
        return (a * b) / PRECISION;
    }

    /// @dev Divides two 1e18 fixed point decimal numbers
    /// @return result = a / b
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // TODO: should we add rounding rules?
        return (a * PRECISION) / b;
    }
}
