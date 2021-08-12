// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";

contract TempusController {
    uint256 private constant _TEMPUS_SHARE_PRECISION = 1e18;

    // TODO: we need to add a reference to ITempusPool in TempusAMM... This would also mean the we can remove the ITempusPool argument
    function depositYBTAndProvideLiquidity(
        ITempusPool targetPool,
        ITempusAMM tempusAMM,
        uint256 yieldTokenAmount
    ) external {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();
        (IERC20[] memory ammTokens, uint256[] memory ammBalances, ) = vault.getPoolTokens(poolId);

        ensureTempusPoolContainsTokens(targetPool, ammTokens);
        require(ammBalances[0] > 0 && ammBalances[1] > 0, "AMM not initialized");

        IERC20 yieldBearingToken = IERC20(targetPool.yieldBearingToken());
        yieldBearingToken.transferFrom(msg.sender, address(this), yieldTokenAmount);
        yieldBearingToken.approve(address(targetPool), yieldTokenAmount);
        targetPool.deposit(yieldTokenAmount, address(this));

        uint256[2] memory ammDepositPercentages = getAMMBalancesRatio(ammBalances);
        uint256[] memory ammLiquidityProvisionAmounts = new uint256[](2);

        (ammLiquidityProvisionAmounts[0], ammLiquidityProvisionAmounts[1]) = (
            (ammTokens[0].balanceOf(address(this)) * ammDepositPercentages[0]) / _TEMPUS_SHARE_PRECISION,
            (ammTokens[1].balanceOf(address(this)) * ammDepositPercentages[1]) / _TEMPUS_SHARE_PRECISION
        );

        ammTokens[0].approve(address(vault), ammLiquidityProvisionAmounts[0]);
        ammTokens[1].approve(address(vault), ammLiquidityProvisionAmounts[1]);

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            assets: ammTokens,
            maxAmountsIn: ammLiquidityProvisionAmounts,
            userData: abi.encode(
                1, /** joins a pre-initialized pool */
                ammLiquidityProvisionAmounts
            ),
            fromInternalBalance: false
        });

        // Provide TPS/TYS liquidity to TempusAMM
        vault.joinPool(poolId, address(this), msg.sender, request);

        // Send remaining Shares to user
        if (ammDepositPercentages[0] < _TEMPUS_SHARE_PRECISION) {
            ammTokens[0].transfer(msg.sender, ammTokens[0].balanceOf(address(this)));
        }
        if (ammDepositPercentages[1] < _TEMPUS_SHARE_PRECISION) {
            ammTokens[1].transfer(msg.sender, ammTokens[1].balanceOf(address(this)));
        }
    }

    // TODO: remove this once we add a refernce from ITempusAMM --> ITempusPool
    function ensureTempusPoolContainsTokens(ITempusPool pool, IERC20[] memory tokens) private view {
        IERC20 principalShare = pool.principalShare();
        IERC20 yieldShare = pool.yieldShare();
        if (principalShare == tokens[0]) {
            require(yieldShare == tokens[1], "TempusPool does not contain given token/s");
        } else {
            require(
                (yieldShare == tokens[0] && principalShare == tokens[1]),
                "TempusPool does not contain given token/s"
            );
        }
    }

    function getAMMBalancesRatio(uint256[] memory ammBalances) private pure returns (uint256[2] memory balancesRatio) {
        uint256 rate = (_TEMPUS_SHARE_PRECISION * ammBalances[0]) / ammBalances[1];

        (balancesRatio[0], balancesRatio[1]) = rate > _TEMPUS_SHARE_PRECISION
            ? (_TEMPUS_SHARE_PRECISION, ((_TEMPUS_SHARE_PRECISION * _TEMPUS_SHARE_PRECISION) / rate))
            : (rate, _TEMPUS_SHARE_PRECISION);
    }
}
