// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "../ITempusPool.sol";
import "../protocols/compound/ICEther.sol";

/// Allows depositing ETH into Compound's CEther contract
contract CompoundEtherDepositWrapper {
    ITempusPool internal immutable pool;
    ICEther internal immutable token;

    constructor(ITempusPool _pool) {
        pool = _pool;

        ICEther cToken = ICEther(_pool.yieldBearingToken());
        require(cToken.isCToken(), "token is not a CToken");
        token = cToken;

        address[] memory markets = new address[](1);
        markets[0] = address(cToken);
        require(cToken.comptroller().enterMarkets(markets)[0] == 0, "enterMarkets failed");
    }

    /// @dev Deposits the supplied Ether to Compound, and then to Tempus Pool.
    ///
    /// @return Amount of TPS and TYS minted to `msg.sender`
    function depositEther() external payable returns (uint256) {
        // Deposit to Compound and receive minted CTokens to this contract
        token.mint{value: msg.value}(); // reverts on failure
        // TODO: Should we record the balance prior to deposit and only transmit the difference?
        //       In case someone transfers Ether directly to this wrapper, that would be sent to the
        //       next random person doing a deposit, or if we do that check, it would be locked up.
        uint256 yieldBearingAmount = token.balanceOf(address(this));

        // Deposit from this contract to Tempus Pool
        // and mint Tempus shares to the original sender
        token.approve(address(pool), yieldBearingAmount);
        return pool.deposit(yieldBearingAmount, msg.sender);
    }
}
