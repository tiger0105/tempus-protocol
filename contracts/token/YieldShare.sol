// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./PoolShare.sol";

/// @dev Token representing the yield shares of a pool.
contract YieldShare is PoolShare {
    // solhint-disable-next-line no-empty-blocks
    constructor(
        ITempusPool _pool,
        string memory name,
        string memory symbol
    ) PoolShare(ShareKind.Yield, _pool, name, symbol) {}

    function pricePerShare() public view override returns (uint256) {
        // TODO: Cannot implement this completely yet, too many additional changes needed
        //       Finish this in another PR
        uint256 price = pool.currentExchangeRate();
        return price;
    }
}
