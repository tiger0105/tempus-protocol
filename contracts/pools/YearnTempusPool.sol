// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../TempusPool.sol";
import "../protocols/yearn/IYearnVaultV2.sol";
import "../utils/UntrustedERC20.sol";
import "../math/Fixed256xVar.sol";

contract YearnTempusPool is TempusPool {
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using Fixed256xVar for uint256;

    IYearnVaultV2 internal immutable yearnVault;
    bytes32 public immutable override protocolName = "Yearn";

    constructor(
        IYearnVaultV2 vault,
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
            address(vault),
            vault.token(),
            controller,
            maturity,
            vault.pricePerShare(),
            10**(IERC20Metadata(vault.token()).decimals()),
            estYield,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol,
            maxFeeSetup
        )
    {
        yearnVault = vault;
    }

    function depositToUnderlying(uint256 amount) internal override returns (uint256) {
        require(msg.value == 0, "ETH deposits not supported");

        // Deposit to Yearn Vault
        IERC20(backingToken).safeIncreaseAllowance(address(yearnVault), amount);

        return yearnVault.deposit(amount);
    }

    function withdrawFromUnderlyingProtocol(uint256 yieldBearingTokensAmount, address recipient)
        internal
        override
        returns (uint256 backingTokenAmount)
    {
        return yearnVault.withdraw(yieldBearingTokensAmount, recipient);
    }

    /// @return Updated current Interest Rate with the same precision as the BackingToken
    function updateInterestRate() internal view override returns (uint256) {
        return yearnVault.pricePerShare();
    }

    /// @return Stored Interest Rate with the same precision as the BackingToken
    function currentInterestRate() public view override returns (uint256) {
        return yearnVault.pricePerShare();
    }

    function numAssetsPerYieldToken(uint yieldTokens, uint rate) public view override returns (uint) {
        return yieldTokens.mulfV(rate, exchangeRateONE);
    }

    function numYieldTokensPerAsset(uint backingTokens, uint rate) public view override returns (uint) {
        return backingTokens.divfV(rate, exchangeRateONE);
    }

    /// @dev The rate precision always matches the BackingToken's precision
    function interestRateToSharePrice(uint interestRate) internal view override returns (uint) {
        return interestRate;
    }
}
