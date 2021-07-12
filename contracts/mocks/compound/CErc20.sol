// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./CTokenMock.sol";

/// Yield Bearing Token for Compound - CErc20 / CToken
contract CErc20 is CTokenMock {
    constructor(
        ComptrollerMock comptrollerInterface,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) CTokenMock(comptrollerInterface, underlyingAsset, name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// User Interface ///

    /// @notice Sender supplies assets into the market and receives cTokens in exchange
    /// @dev Reverts upon any failure
    function mint() external payable {
        mintInternal(msg.sender, msg.value);
    }
}
