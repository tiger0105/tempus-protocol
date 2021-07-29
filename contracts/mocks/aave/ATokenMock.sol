// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "./../../token/ERC20OwnerMintableToken.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "./WadRayMath.sol";

/// Yield Bearing Token for AAVE - AToken
contract ATokenMock is ERC20OwnerMintableToken, IAToken {
    address public immutable override UNDERLYING_ASSET_ADDRESS;
    ILendingPool public override POOL;

    using WadRayMath for uint;

    constructor(
        ILendingPool pool,
        address underlyingAssetAddress,
        string memory name,
        string memory symbol
    ) ERC20OwnerMintableToken(name, symbol) {
        POOL = pool;
        UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return ERC20.balanceOf(account).rayMul(POOL.getReserveNormalizedIncome(address(UNDERLYING_ASSET_ADDRESS)));
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        ERC20._transfer(from, to, amount.rayDiv(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS)));
    }
}
