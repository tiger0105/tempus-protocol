// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "../ITempusPool.sol";
import "../protocols/lido/ILido.sol";

contract LidoDepositWrapper {
    ITempusPool internal immutable pool;
    ILido internal immutable lido;

    constructor(ITempusPool _pool) {
        ILido _lido = ILido(_pool.yieldBearingToken());
        // TODO: consider adding sanity check for _lido.name() and _lido.symbol()

        pool = _pool;
        lido = _lido;
    }

    /// Deposits the supplied Ether to Lido, and then to Tempus Pool.
    /// Lido will reject zero-Ether deposits.
    ///
    /// @return Amount of TPS and TYS minted to `msg.sender`
    function deposit() external payable returns (uint256) {
        // Deposit to Lido and receive number of StETH shares
        uint256 shares = lido.submit{value: msg.value}(address(0));

        // Deposit to the TempusPool
        lido.approve(address(pool), shares);
        return pool.deposit(shares, msg.sender);
    }
}
