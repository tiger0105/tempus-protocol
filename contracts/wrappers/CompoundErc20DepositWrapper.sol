// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../ITempusPool.sol";
// TODO: replace these with protocol interfaces
import "../mocks/compound/CErc20.sol";
import "../mocks/compound/CTokenInterfaces.sol";

/// Allows depositing ERC20 into Compound's CErc20 contracts
contract CompoundErc20DepositWrapper {
    using SafeERC20 for IERC20;

    ITempusPool internal immutable pool;
    CErc20 internal immutable token;
    IERC20 internal immutable backingToken;

    constructor(ITempusPool _pool) {
        pool = _pool;

        CErc20 cToken = CErc20(_pool.yieldBearingToken());
        require(cToken.isCToken(), "token is not a CToken");
        token = cToken;
        backingToken = IERC20(cToken.underlying());

        address[] memory markets = new address[](1);
        markets[0] = address(cToken);
        require(cToken.comptroller().enterMarkets(markets)[0] == 0, "enterMarkets failed");
    }

    /// @dev Deposits the supplied ERC20 backing token to Compound and then to Tempus Pool
    ///      `msg.sender` must approve `amount` on `backingToken` to this wrapper.
    /// @param amount Number of ERC20 backing tokens to deposit
    /// @return Amount of TPS and TYS minted to `msg.sender`
    function deposit(uint256 amount) external returns (uint256) {
        // Transfer backingToken to the wrapper
        backingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to Compound and receive minted CTokens to this contract
        backingToken.approve(address(token), amount);
        require(token.mint(amount) == 0, "CErc20 mint failed");
        // TODO: Should we record the balance prior to deposit and only transmit the difference?
        //       In case someone transfers cDAI directly to this wrapper, that would be sent to the
        //       next random person doing a deposit, or if we do that check, it would be locked up.
        uint256 yieldBearingAmount = token.balanceOf(address(this));

        // Deposit from this contract to Tempus Pool
        // and mint Tempus shares to the original sender
        token.approve(address(pool), yieldBearingAmount);
        return pool.deposit(yieldBearingAmount, msg.sender);
    }
}
