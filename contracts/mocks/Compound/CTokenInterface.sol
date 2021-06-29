// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./ComptrollerInterface.sol";

abstract contract CTokenInterface {
    /// @notice Contract which oversees inter-cToken operations
    function comptroller() external virtual view returns (ComptrollerInterface);

    /// @notice Underlying asset for this CToken
    function underlying() external virtual view returns (address);

    /// @notice Accrue interest then return the up-to-date exchange rate
    /// @return Calculated exchange rate scaled by 1e18
    function exchangeRateCurrent() external virtual returns (uint);
}
