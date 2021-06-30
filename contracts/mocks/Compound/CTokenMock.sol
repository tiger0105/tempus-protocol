// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ComptrollerMock.sol";

/// Yield Bearing Token for AAVE - AToken
contract CTokenMock is ERC20 {
    ComptrollerMock public immutable comptroller;
    address public immutable underlying;

    constructor(
        ComptrollerMock comptrollerInterface,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        comptroller = comptrollerInterface;
        underlying = underlyingAsset;
    }

    function exchangeRateCurrent() public view returns (uint) {
        return comptroller.exchangeRate();
    }

    /// User Interface ///

    function mintInternal(address minter, uint mintAmount) internal {
        uint exchangeRate = exchangeRateCurrent();
        uint actualMintAmount = doTransferIn(minter, mintAmount);

        uint mintTokens = (actualMintAmount*1e18) / exchangeRate;
        _mint(minter, mintTokens);
    }

    /// @dev Kept the names from Compound's CErc20
    function doTransferIn(address minter, uint mintAmount) internal returns (uint) {
        ERC20 backingToken = ERC20(underlying);
        backingToken.transferFrom(minter, address(this), mintAmount);
        return mintAmount;
    }
}
