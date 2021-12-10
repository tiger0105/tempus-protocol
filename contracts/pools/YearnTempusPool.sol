// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

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
        TokenData memory principalsData,
        TokenData memory yieldsData,
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
            principalsData,
            yieldsData,
            maxFeeSetup
        )
    {
        yearnVault = vault;
    }

    function depositToUnderlying(uint256 amount) internal override returns (uint256) {
        // ETH deposits are not accepted, because it is rejected in the controller
        assert(msg.value == 0);

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

    function numAssetsPerYieldToken(uint256 yieldTokens, uint256 rate) public view override returns (uint256) {
        return yieldTokens.mulfV(rate, exchangeRateONE);
    }

    function numYieldTokensPerAsset(uint256 backingTokens, uint256 rate) public view override returns (uint256) {
        return backingTokens.divfV(rate, exchangeRateONE);
    }

    /// @dev The rate precision always matches the BackingToken's precision
    function interestRateToSharePrice(uint256 interestRate) internal pure override returns (uint256) {
        return interestRate;
    }
}
