// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ERC20OwnerMintableToken.sol";
import "../ITempusPool.sol";

/// Token representing the principal or yield shares of a pool.
abstract contract PoolShare is ERC20OwnerMintableToken {
    enum ShareKind {
        Principal,
        Yield
    }

    /// The kind of the share.
    ShareKind immutable kind;

    /// The pool this share is part of.
    ITempusPool immutable pool;

    constructor(
        ShareKind _kind,
        ITempusPool _pool,
        string memory name,
        string memory symbol
    ) ERC20OwnerMintableToken(name, symbol) {
        kind = _kind;
        pool = _pool;
    }

    /// @dev Price per single share when exchanging back to Yield Bearing Tokens
    ///      of the underlying pool.
    ///      This is for Curve api support.
    ///      Example: exchanging Tempus Yield Share to aDAI
    /// @return 1e18 decimal conversion rate per share
    function getPricePerFullShare() public view virtual returns (uint256);
}
