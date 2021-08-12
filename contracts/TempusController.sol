// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";
import "./math/FixedPoint18.sol";

contract TempusController {
    using FixedPoint18 for uint256;

    // TODO: we need to add a reference to ITempusPool in TempusAMM... This would also mean the we can remove the ITempusPool argument

    /// @dev Atomically deposits Yield Bearing Tokens to TempusPool and provides liquidity
    ///      to the corresponding Tempus AMM with the issued TYS & TPS
    /// @param targetPool Tempus Pool to which YBT will be deposited
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param yieldTokenAmount Amount of Yield Bearing Tokens to deposit
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

        depositToTempusPool(targetPool, yieldTokenAmount);

        uint256[2] memory ammDepositPercentages = getAMMBalancesRatio(ammBalances);
        uint256[] memory ammLiquidityProvisionAmounts = new uint256[](2);

        (ammLiquidityProvisionAmounts[0], ammLiquidityProvisionAmounts[1]) = (
            ammTokens[0].balanceOf(address(this)).mulf18(ammDepositPercentages[0]),
            ammTokens[1].balanceOf(address(this)).mulf18(ammDepositPercentages[1])
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
        if (ammDepositPercentages[0] < FixedPoint18.ONE) {
            ammTokens[0].transfer(msg.sender, ammTokens[0].balanceOf(address(this)));
        }
        if (ammDepositPercentages[1] < FixedPoint18.ONE) {
            ammTokens[1].transfer(msg.sender, ammTokens[1].balanceOf(address(this)));
        }
    }

    /// @dev Atomically deposits Yield Bearing Tokens to TempusPool and swaps TYS for TPS to get fixed yield
    /// @param targetPool Tempus Pool to which YBT will be deposited
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param yieldTokenAmount Amount of Yield Bearing Tokens to deposit
    /// @param minTYSRate Minimum TYS rate (denominated in TPS) to receive in exchange to TPS
    function depositYBTAndFix(
        ITempusPool targetPool,
        ITempusAMM tempusAMM,
        uint256 yieldTokenAmount,
        uint256 minTYSRate
    ) external {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();
        (IERC20[] memory ammTokens, , ) = vault.getPoolTokens(poolId);

        ensureTempusPoolContainsTokens(targetPool, ammTokens);

        depositToTempusPool(targetPool, yieldTokenAmount);

        IERC20 principalShares = IERC20(targetPool.principalShare());
        IERC20 yieldShares = IERC20(targetPool.yieldShare());
        uint256 swapAmount = yieldShares.balanceOf(address(this));
        yieldShares.approve(address(vault), swapAmount);

        // // Provide TPS/TYS liquidity to TempusAMM
        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: yieldShares,
            assetOut: principalShares,
            amount: swapAmount,
            userData: "0x0"
        });

        IVault.FundManagement memory fundManagement = IVault.FundManagement({
            sender: address(this),
            fromInternalBalance: false,
            recipient: payable(address(this)),
            toInternalBalance: false
        });

        uint256 minReturn = minTYSRate.mulf18(swapAmount);
        vault.swap(singleSwap, fundManagement, minReturn, block.timestamp);

        uint256 TPSBalance = principalShares.balanceOf(address(this));
        assert(TPSBalance > 0);
        assert(yieldShares.balanceOf(address(this)) == 0);

        principalShares.transfer(msg.sender, TPSBalance);
    }

    function depositToTempusPool(ITempusPool targetPool, uint256 yieldTokenAmount) private {
        require(yieldTokenAmount > 0, "yieldTokenAmount is 0");

        IERC20 yieldBearingToken = IERC20(targetPool.yieldBearingToken());

        // Deposit to TempusPool
        yieldBearingToken.transferFrom(msg.sender, address(this), yieldTokenAmount);
        yieldBearingToken.approve(address(targetPool), yieldTokenAmount);
        targetPool.deposit(yieldTokenAmount, address(this));
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
        uint256 rate = ammBalances[0].divf18(ammBalances[1]);

        (balancesRatio[0], balancesRatio[1]) = rate > FixedPoint18.ONE
            ? (FixedPoint18.ONE, FixedPoint18.ONE.divf18(rate))
            : (rate, FixedPoint18.ONE);
    }
}
