// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../TempusPool.sol";
import "../protocols/compound/ICErc20.sol";

/// Allows depositing ERC20 into Compound's CErc20 contracts
contract CompoundTempusPool is TempusPool {
    using SafeERC20 for IERC20;

    ICErc20 internal immutable cToken;

    constructor(
        ICErc20 token,
        IPriceOracle oracle,
        uint256 maturity,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    )
        TempusPool(
            address(token),
            token.underlying(),
            oracle,
            maturity,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol
        )
    {
        require(token.isCToken(), "token is not a CToken");

        address[] memory markets = new address[](1);
        markets[0] = address(token);
        require(token.comptroller().enterMarkets(markets)[0] == 0, "enterMarkets failed");

        cToken = token;
    }

    function depositToUnderlying(uint256 amount) internal override returns (uint256) {
        require(msg.value == 0, "ETH deposits not supported");

        uint256 preDepositBalance = IERC20(yieldBearingToken).balanceOf(address(this));

        // Pull user's Backing Tokens
        IERC20(backingToken).safeTransferFrom(msg.sender, address(this), amount);

        // Deposit to Compound
        IERC20(backingToken).safeIncreaseAllowance(address(cToken), amount);
        require(cToken.mint(amount) == 0, "CErc20 mint failed");

        uint256 mintedTokens = IERC20(yieldBearingToken).balanceOf(address(this)) - preDepositBalance;
        return mintedTokens;
    }

    function withdrawFromUnderlyingProtocol(uint256 yieldBearingTokensAmount, address recipient)
        internal
        override
        returns (uint256 backingTokenAmount)
    {
        // -- deposit wrapper now owns YBT
        assert(cToken.balanceOf(address(this)) >= yieldBearingTokensAmount);

        IERC20(backingToken).safeIncreaseAllowance(msg.sender, yieldBearingTokensAmount);
        cToken.redeem(yieldBearingTokensAmount);

        uint256 backing = (yieldBearingTokensAmount * cToken.exchangeRateStored()) / 1e18;
        IERC20(backingToken).safeTransfer(recipient, backing);

        return backing;
    }
}
