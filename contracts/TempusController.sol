// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";
import "./math/Fixed256x18.sol";

contract TempusController is Ownable {
    using Fixed256x18 for uint256;
    using SafeERC20 for IERC20;

    /// @dev Atomically deposits YBT/BT to TempusPool and provides liquidity
    ///      to the corresponding Tempus AMM with the issued TYS & TPS
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    function depositAndProvideLiquidity(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken
    ) external payable {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();
        (IERC20[] memory ammTokens, uint256[] memory ammBalances, ) = vault.getPoolTokens(poolId);
        require(ammBalances[0] > 0 && ammBalances[1] > 0, "AMM not initialized");

        ITempusPool targetPool = tempusAMM.tempusPool();

        if (isBackingToken) {
            depositBackingTokens(targetPool, tokenAmount);
        } else {
            depositYieldBearingTokens(targetPool, tokenAmount);
        }

        uint256[2] memory ammDepositPercentages = getAMMBalancesRatio(ammBalances);
        uint256[] memory ammLiquidityProvisionAmounts = new uint256[](2);

        (ammLiquidityProvisionAmounts[0], ammLiquidityProvisionAmounts[1]) = (
            ammTokens[0].balanceOf(address(this)).mulf18(ammDepositPercentages[0]),
            ammTokens[1].balanceOf(address(this)).mulf18(ammDepositPercentages[1])
        );

        ammTokens[0].safeIncreaseAllowance(address(vault), ammLiquidityProvisionAmounts[0]);
        ammTokens[1].safeIncreaseAllowance(address(vault), ammLiquidityProvisionAmounts[1]);

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
        if (ammDepositPercentages[0] < Fixed256x18.ONE) {
            ammTokens[0].safeTransfer(msg.sender, ammTokens[0].balanceOf(address(this)));
        }
        if (ammDepositPercentages[1] < Fixed256x18.ONE) {
            ammTokens[1].safeTransfer(msg.sender, ammTokens[1].balanceOf(address(this)));
        }
    }

    /// @dev Atomically deposits YBT/BT to TempusPool and swaps TYS for TPS to get fixed yield
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    /// @param minTYSRate Minimum TYS rate (denominated in TPS) to receive in exchange to TPS
    function depositAndFix(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken,
        uint256 minTYSRate
    ) external payable {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();

        ITempusPool targetPool = tempusAMM.tempusPool();

        if (isBackingToken) {
            depositBackingTokens(targetPool, tokenAmount);
        } else {
            depositYieldBearingTokens(targetPool, tokenAmount);
        }

        IERC20 principalShares = IERC20(address(targetPool.principalShare()));
        IERC20 yieldShares = IERC20(address(targetPool.yieldShare()));
        uint256 swapAmount = yieldShares.balanceOf(address(this));
        yieldShares.safeIncreaseAllowance(address(vault), swapAmount);

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

        principalShares.safeTransfer(msg.sender, TPSBalance);
    }

    function depositYieldBearingTokens(ITempusPool targetPool, uint256 yieldTokenAmount) private {
        require(yieldTokenAmount > 0, "yieldTokenAmount is 0");

        IERC20 yieldBearingToken = IERC20(targetPool.yieldBearingToken());

        // Deposit to TempusPool
        yieldBearingToken.safeTransferFrom(msg.sender, address(this), yieldTokenAmount);
        yieldBearingToken.safeIncreaseAllowance(address(targetPool), yieldTokenAmount);
        targetPool.deposit(yieldTokenAmount, address(this));
    }

    function depositBackingTokens(ITempusPool targetPool, uint256 backingTokenAmount) private {
        require(backingTokenAmount > 0, "backingTokenAmount is 0");
        IERC20 backingToken = IERC20(targetPool.backingToken());

        if (msg.value == 0) {
            backingToken.safeTransferFrom(msg.sender, address(this), backingTokenAmount);
            backingToken.safeIncreaseAllowance(address(targetPool), backingTokenAmount);
            targetPool.depositBackingToken(backingTokenAmount, address(this));
        } else {
            require(address(backingToken) == address(0), "given TempusPool's Backing Token is not ETH");

            targetPool.depositBackingToken{value: msg.value}(backingTokenAmount, address(this));
        }
    }

    function getAMMBalancesRatio(uint256[] memory ammBalances) private pure returns (uint256[2] memory balancesRatio) {
        uint256 rate = ammBalances[0].divf18(ammBalances[1]);

        (balancesRatio[0], balancesRatio[1]) = rate > Fixed256x18.ONE
            ? (Fixed256x18.ONE, Fixed256x18.ONE.divf18(rate))
            : (rate, Fixed256x18.ONE);
    }
}
