// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "hardhat/console.sol";

/// @dev Fixed Point decimal math utils for variable decimal point precision
///      on 256-bit wide numbers
library Fixed256xVar {
    /// @dev Multiplies two variable precision fixed point decimal numbers
    /// @param one 1.0 expressed in the base precision of `a` and `b`
    /// @return result = a * b
    function mulfV(
        uint256 a,
        uint256 b,
        uint256 one
    ) internal pure returns (uint256) {
        // TODO: should we add rounding rules?
        return (a * b) / one;
    }

    /// @dev Divides two variable precision fixed point decimal numbers
    /// @param one 1.0 expressed in the base precision of `a` and `b`
    /// @return result = a / b
    function divfV(
        uint256 a,
        uint256 b,
        uint256 one
    ) internal pure returns (uint256) {
        // TODO: should we add rounding rules?
        return (a * one) / b;
    }

    /// @dev Debug prints decimal `a`, taking `one` as the base 1.0 value
    function printfV(uint256 a, uint256 one) internal view {
        console.log("%s", decimalToString(a, one));
    }

    function printfV(
        string memory title,
        uint256 a,
        uint256 one
    ) internal view {
        console.log("%s=%s", title, decimalToString(a, one));
    }

    function decimalToString(uint256 value, uint256 one) internal pure returns (string memory) {
        uint decimals = 0;
        for (uint x = one / 10; x > 0; x = x / 10) {
            ++decimals;
        }

        bytes memory buffer = new bytes(78); // uint256 has max 78 digits
        uint len = 0;
        for (uint i = 0; i < decimals; ++i) {
            uint digit = value % 10;
            value = value / 10;
            buffer[len++] = bytes1(uint8(48 + digit));
        }

        buffer[len++] = bytes1(uint8(46)); // "."
        if (value == 0) {
            buffer[len++] = bytes1(uint8(48)); // "0"
        } else {
            while (value != 0) {
                uint digit = value % 10;
                value = value / 10;
                buffer[len++] = bytes1(uint8(48 + digit));
            }
        }

        // reverse the string
        bytes memory s = new bytes(len);
        for (uint j = 0; j < len; j++) {
            s[j] = buffer[len - j - 1];
        }
        return string(s);
    }
}
