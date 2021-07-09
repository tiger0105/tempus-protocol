// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../ITempusPool.sol";
import "../mocks/lido/ILido.sol";

contract LidoDepositWrapper {
    ITempusPool internal immutable pool;
    ILido internal immutable lido;

    constructor(ITempusPool _pool) {
        ILido _lido = ILido(_pool.yieldBearingToken());
        // Sanity checks
        IERC20Metadata lidoMetadata = IERC20Metadata(address(_lido));
        require(keccak256(bytes(lidoMetadata.name())) == keccak256(bytes("Liquid staked Ether 2.0")));
        require(keccak256(bytes(lidoMetadata.symbol())) == keccak256(bytes("stETH")));

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
        // TODO: do we need to use SafeERC20 for this? We should double check Lido that it conforms to ERC20 and avoid SafeERC20.
        IERC20(address(lido)).approve(address(pool), shares);
        return pool.deposit(shares, msg.sender);
    }
}
