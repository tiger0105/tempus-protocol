// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./../../token/ERC20OwnerMintableToken.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";

/// Yield Bearing Token for AAVE - AToken
contract ATokenMock is ERC20OwnerMintableToken, IAToken {
    address public immutable override UNDERLYING_ASSET_ADDRESS;
    ILendingPool public override POOL;

    constructor(
        ILendingPool pool,
        address underlyingAssetAddress,
        string memory name,
        string memory symbol
    ) ERC20OwnerMintableToken(name, symbol) {
        POOL = pool;
        UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
    }
}
