// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./CTokenMock.sol";
import "./CTokenInterfaces.sol";

/// Token to support ETH deposits
contract CEther is CTokenMock {
    constructor(
        ComptrollerInterface comptroller_,
        string memory name,
        string memory symbol
    ) CTokenMock(comptroller_, name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// User Interface ///

    /// @notice Sender supplies ETH into the market and receives cTokens in exchange
    /// @dev Reverts upon any failure
    function mint() external payable {
        (uint err, ) = mintInternal(msg.value);
        require(err == 0, "mint failed");
    }

    /**
     * @notice Perform the actual transfer in, which is a no-op
     * @param from Address sending the Ether
     * @param amount Amount of Ether being sent
     * @return The actual amount of Ether transferred
     */
    function doTransferIn(address from, uint amount) internal override returns (uint) {
        // Sanity checks
        require(msg.sender == from, "sender mismatch");
        require(msg.value == amount, "value mismatch");
        return amount;
    }
}
