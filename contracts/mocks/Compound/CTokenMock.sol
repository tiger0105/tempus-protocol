// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./../../token/ERC20OwnerMintableToken.sol";
import "./CTokenInterface.sol";
import "./ComptrollerInterface.sol";
import "./ComptrollerMock.sol";

/// Yield Bearing Token for AAVE - AToken
contract CTokenMock is ERC20OwnerMintableToken, CTokenInterface {
    ComptrollerInterface public override comptroller;
    address public immutable override underlying;

    constructor(
        ComptrollerInterface comptrollerInterface,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) ERC20OwnerMintableToken(name, symbol) {
        comptroller = comptrollerInterface;
        underlying = underlyingAsset;
    }

    function exchangeRateCurrent() external override returns (uint) {
        return ComptrollerMock(comptroller).exchangeRate;
    }
}
