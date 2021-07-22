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

    /// @dev This is for Curve api support.
    function getPricePerFullShare() public view override returns (uint256) {
        return pool.pricePerYieldShare();
    }
}
