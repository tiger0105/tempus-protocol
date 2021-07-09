// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ComptrollerMock.sol";
import "./CTokenInterfaces.sol";

/// Yield Bearing Token for Compound - CToken
abstract contract CTokenMock is ERC20, CTokenInterface {
    constructor(
        ComptrollerInterface comptroller_,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        comptroller = comptroller_;
    }

    /// User Interface ///

    function exchangeRateCurrent() public view override returns (uint) {
        // TODO: this exchange rate is completely mocked
        ComptrollerMock mock = ComptrollerMock(address(comptroller));
        return mock.exchangeRate();
    }

    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     * @dev Accrues interest whether or not the operation succeeds, unless reverted
     * @param mintAmount The amount of the underlying asset to supply
     * @return (uint, uint) An error code (0=success, otherwise a failure,
               see ErrorReporter.sol), and the actual mint amount.
     */
    function mintInternal(uint mintAmount) internal returns (uint, uint) {
        // mintFresh emits the actual Mint event if successful and logs on errors, so we don't need to
        return mintFresh(msg.sender, mintAmount);
    }

    function mintFresh(address minter, uint mintAmount) internal returns (uint, uint) {
        uint err = comptroller.mintAllowed(address(this), minter, mintAmount);
        require(err == 0, "mint is not allowed");

        uint exchangeRate = exchangeRateCurrent();

        /*
         *  We call `doTransferIn` for the minter and the mintAmount.
         *  Note: The cToken must handle variations between ERC-20 and ETH underlying.
         *  `doTransferIn` reverts if anything goes wrong, since we can't be sure if
         *  side-effects occurred. The function returns the amount actually transferred,
         *  in case of a fee. On success, the cToken holds an additional `actualMintAmount`
         *  of cash.
         */
        uint actualMintAmount = doTransferIn(minter, mintAmount);

        uint mintTokens = (actualMintAmount * 1e18) / exchangeRate;
        _mint(minter, mintTokens);
        return (0, actualMintAmount);
    }

    /**
     * @dev Performs a transfer in, reverting upon failure. Returns the amount actually
     *      transferred to the protocol, in case of a fee.
     *  This may revert due to insufficient balance or insufficient allowance.
     */
    function doTransferIn(address from, uint amount) internal virtual returns (uint);
}
