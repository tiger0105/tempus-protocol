// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./CTokenMock.sol";
import "./CTokenInterfaces.sol";

/// Token to support ETH deposits
contract CEther is CTokenMock {
    constructor(
        ComptrollerInterface comptrollerInterface,
        string memory name,
        string memory symbol
    ) CTokenMock(comptrollerInterface, name, symbol) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// User Interface ///

    /// @notice Sender supplies ETH into the market and receives cTokens in exchange
    /// @dev Reverts upon any failure
    function mint() external payable {
        mintInternal(msg.value);
    }

    /**
     * @notice Perform the actual transfer in, which is a no-op
     * @param from Address sending the Ether
     * @param amount Amount of Ether being sent
     * @return The actual amount of Ether transferred
     */
    function doTransferIn(address from, uint amount) internal pure override returns (uint) {
        // NOTE: Nothing to do in pure ETH transfers
        from;
        return amount;
    }
}
