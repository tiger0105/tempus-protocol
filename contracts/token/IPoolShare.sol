// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPriceable.sol";
import "./../ITempusPool.sol";

/// Interface of Tokens representing the principal or yield shares of a pool.
interface IPoolShare is IPriceable, IERC20 {
    enum ShareKind {
        Principal,
        Yield
    }

    /// The kind of the share.
    function kind() external returns(ShareKind);

    /// The pool this share is part of.
    function pool() external returns(ITempusPool);
}