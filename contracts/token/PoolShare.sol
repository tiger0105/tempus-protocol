// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "./ERC20OwnerMintableToken.sol";
import "../ITempusPool.sol";

/// Token representing the principal or yield shares of a pool.
contract PoolShare is ERC20OwnerMintableToken {
    enum ShareKind {Principal, Yield}

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
}
