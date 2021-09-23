// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../TempusPool.sol";
import "../protocols/compound/ICErc20.sol";
import "../math/Fixed256x18.sol";
import "../utils/UntrustedERC20.sol";
import "hardhat/console.sol";

/// Allows depositing ERC20 into Compound's CErc20 contracts
contract CompoundTempusPool is TempusPool {
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using Fixed256x18 for uint256;

    ICErc20 internal immutable cToken;
    bytes32 public immutable override protocolName = "Compound";

    constructor(
        ICErc20 token,
        address controller,
        uint256 maturity,
        uint256 estYield,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol,
        FeesConfig memory maxFeeSetup
    )
        TempusPool(
            address(token),
            token.underlying(),
            controller,
            maturity,
            updateInterestRate(address(token)),
            estYield,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol,
            maxFeeSetup
        )
    {
        require(token.isCToken(), "token is not a CToken");
        require(token.decimals() == 8, "CErc20 token must have 8 decimals precision");
        require(ICErc20(token.underlying()).decimals() == 18, "Underlying ERC20 token must have 18 decimals precision");

        address[] memory markets = new address[](1);
        markets[0] = address(token);
        require(token.comptroller().enterMarkets(markets)[0] == 0, "enterMarkets failed");

        cToken = token;
    }

    function depositToUnderlying(uint256 backingAmount) internal override returns (uint256) {
        require(msg.value == 0, "ETH deposits not supported");

        uint preDepositBalance = IERC20(yieldBearingToken).balanceOf(address(this));

        // Pull user's Backing Tokens
        backingAmount = IERC20(backingToken).untrustedTransferFrom(msg.sender, address(this), backingAmount);

        // Deposit to Compound
        IERC20(backingToken).safeIncreaseAllowance(address(cToken), backingAmount);
        require(cToken.mint(backingAmount) == 0, "CErc20 mint failed");

        uint mintedTokens = IERC20(yieldBearingToken).balanceOf(address(this)) - preDepositBalance;
        return yieldTokenAmountToFixed18(mintedTokens);
    }

    function withdrawFromUnderlyingProtocol(uint256 yieldBearingTokensAmount, address recipient)
        internal
        override
        returns (uint256 backingTokenAmount)
    {
        // tempus pool owns YBT
        uint contractYBTAmount = fixed18ToYieldTokenAmount(yieldBearingTokensAmount);
        console.log("withdrawFromUnderlyingProtocol:", yieldBearingTokensAmount, contractYBTAmount);
        assert(cToken.balanceOf(address(this)) >= contractYBTAmount);
        require(cToken.redeem(contractYBTAmount) == 0, "CErc20 redeem failed");

        uint rate = updateInterestRate(address(cToken));
        uint backing = numAssetsPerYieldToken(yieldBearingTokensAmount, rate);
        console.log("withdrawAmount YBT F18:", yieldBearingTokensAmount);
        console.log("withdrawAmount YBT  F8:", contractYBTAmount);
        console.log("withdrawAmount  BT:", backing);
        console.log("contractBalance BT:", IERC20(backingToken).balanceOf(address(this)));
        backing = IERC20(backingToken).untrustedTransfer(recipient, backing);

        return backing;
    }

    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate(address token) internal override returns (uint256) {
        // NOTE: exchangeRateCurrent() will accrue interest and gets the latest Interest Rate
        //       We do this to avoid arbitrage
        //       The default exchange rate for Compound is 0.02 and grows
        //       cTokens are minted as (backingAmount / rate), so 1 DAI = 50 cDAI with 0.02 rate
        uint256 rate = ICToken(token).exchangeRateCurrent() / 1e10;
        return rate;
    }

    /// @return Current Interest Rate as an 1e18 decimal
    function storedInterestRate(address token) internal view override returns (uint256) {
        uint256 rate = ICToken(token).exchangeRateStored() / 1e10;
        return rate;
    }

    function numAssetsPerYieldToken(uint yieldTokens, uint rate) public pure override returns (uint) {
        return yieldTokens.mulf18(rate);
        // uint assets = yieldTokens.mulf18(rate);
        // // because yieldTokens actually has less precision, the remainder needs to be truncated
        // return (assets / 1e10) * 1e10; // truncate and rescale
    }

    // NOTE: Return value is in Fixed18, additional conversion to fixed8 is needed depending on usage
    function numYieldTokensPerAsset(uint backingTokens, uint rate) public pure override returns (uint) {
        return backingTokens.divf18(rate);
    }

    function yieldTokenAmountToFixed18(uint yieldTokens) public pure override returns (uint) {
        return yieldTokens * 1e10; // from fixed8 to fixed18
    }

    function fixed18ToYieldTokenAmount(uint fixed18amount) public pure override returns (uint) {
        return fixed18amount / 1e10; // from fixed18 to fixed8
    }
}
