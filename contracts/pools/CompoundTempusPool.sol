// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../TempusPool.sol";
import "../protocols/compound/ICErc20.sol";
import "../math/Fixed256x18.sol";
import "../utils/UntrustedERC20.sol";

/// Allows depositing ERC20 into Compound's CErc20 contracts
contract CompoundTempusPool is TempusPool {
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using Fixed256x18 for uint256;

    ICErc20 internal immutable cToken;
    bytes32 public immutable override protocolName = "Compound";

    uint256 internal immutable exchangeRateScale;

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
            token.exchangeRateCurrent() / 1e10,
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
        uint8 underlyingDecimals = ICErc20(token.underlying()).decimals();
        require(underlyingDecimals <= 36, "Underlying ERC20 token decimals must be <= 36");

        // We use uncheked because of boundaries we check for underlying decimals
        unchecked {
            // If we have 8 decimals for underlying, exchange rate in Compound is 18 decimal precision
            // So, more than 8 decimals, we need to divide by 1e(underlyingDecimals - 8)
            // And for less than 8 we need to scale by 1e-(8 - underlyingdecimals)
            exchangeRateScale = (underlyingDecimals >= 8)
                ? Fixed256x18.ONE * (10**(underlyingDecimals - 8))
                : Fixed256x18.ONE / (10**(10 - underlyingDecimals));
        }

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
        assert(cToken.balanceOf(address(this)) >= contractYBTAmount);
        require(cToken.redeem(contractYBTAmount) == 0, "CErc20 redeem failed");

        // need to rescale the truncated amount which was used during cToken.redeem()
        uint redeemedYBT = yieldTokenAmountToFixed18(contractYBTAmount);
        uint backing = numAssetsPerYieldToken(redeemedYBT, updateInterestRate());
        backing = IERC20(backingToken).untrustedTransfer(recipient, backing);
        return backing;
    }

    /// @return Updated current Interest Rate as an 1e18 decimal
    function updateInterestRate() internal override returns (uint256) {
        // NOTE: exchangeRateCurrent() will accrue interest and gets the latest Interest Rate
        //       We do this to avoid arbitrage
        //       The default exchange rate for Compound is 0.02 and grows
        //       cTokens are minted as (backingAmount / rate), so 1 DAI = 50 cDAI with 0.02 rate
        return cToken.exchangeRateCurrent().divf18(exchangeRateScale);
    }

    /// @return Current Interest Rate as an 1e18 decimal
    function currentInterestRate() public view override returns (uint256) {
        return cToken.exchangeRateStored().divf18(exchangeRateScale);
    }

    // NOTE: yieldTokens must be fixed18 regardless of cToken YBT decimals
    function numAssetsPerYieldToken(uint yieldTokens, uint rate) public pure override returns (uint) {
        return yieldTokens.mulf18(rate);
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
