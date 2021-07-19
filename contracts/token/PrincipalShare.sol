// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./PoolShare.sol";

/// @dev Token representing the principal shares of a pool.
contract PrincipalShare is PoolShare {
    // solhint-disable-next-line no-empty-blocks
    constructor(
        ITempusPool _pool,
        string memory name,
        string memory symbol
    ) PoolShare(ShareKind.Principal, _pool, name, symbol) {}

    function pricePerShare() public pure override returns (uint256) {
        return 1e18;
    }
}
