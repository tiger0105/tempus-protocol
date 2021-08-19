// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "../TempusPool.sol";
import "../protocols/lido/ILido.sol";

contract LidoTempusPool is TempusPool {
    ILido internal immutable lido;

    constructor(
        ILido token,
        IPriceOracle oracle,
        uint256 maturity,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    ) TempusPool(address(token), address(0), oracle, maturity, principalName, principalSymbol, yieldName, yieldSymbol) {
        // TODO: consider adding sanity check for _lido.name() and _lido.symbol()
        lido = token;
    }

    function depositToUnderlying(uint256 amount) internal override returns (uint256) {
        require(msg.value == amount, "ETH value does not match provided amount");

        uint256 preDepositBalance = IERC20(yieldBearingToken).balanceOf(address(this));
        lido.submit{value: msg.value}(address(0));

        /// TODO: figure out why lido.submit returns a different value than this
        uint256 mintedTokens = IERC20(yieldBearingToken).balanceOf(address(this)) - preDepositBalance;

        return mintedTokens;
    }

    function withdrawFromUnderlyingProtocol(uint256, address)
        internal
        pure
        override
        returns (uint256 backingTokenAmount)
    {
        require(false, "LidoTempusPool.withdrawFromUnderlyingProtocol not supported");
        return 0;
    }
}
