// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";
import "./math/Fixed256x18.sol";
import "./utils/PermanentlyOwnable.sol";
import "./utils/AMMBalancesHelper.sol";
import "./utils/UntrustedERC20.sol";

import "hardhat/console.sol";

contract TempusController is PermanentlyOwnable, ReentrancyGuard {
    using Fixed256x18 for uint256;
    using SafeERC20 for IERC20;
    using UntrustedERC20 for IERC20;
    using AMMBalancesHelper for uint256[];

    /// @dev Event emitted on a successful BT/YBT deposit.
    /// @param pool The Tempus Pool to which assets were deposited
    /// @param depositor Address of the user who deposited Yield Bearing Tokens to mint
    ///                  Tempus Principal Share (TPS) and Tempus Yield Shares
    /// @param recipient Address of the recipient who will receive TPS and TYS tokens
    /// @param yieldTokenAmount Amount of yield tokens received from underlying pool
    /// @param backingTokenValue Value of @param yieldTokenAmount expressed in backing tokens
    /// @param shareAmounts Number of Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS) granted to `recipient`
    /// @param interestRate Interest Rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    /// @param fee The fee which was deducted (in terms of yield bearing tokens)
    event Deposited(
        address indexed pool,
        address indexed depositor,
        address indexed recipient,
        uint256 yieldTokenAmount,
        uint256 backingTokenValue,
        uint256 shareAmounts,
        uint256 interestRate,
        uint256 fee
    );

    /// @dev Event emitted on a successful BT/YBT redemption.
    /// @param pool The Tempus Pool from which Tempus Shares were redeemed
    /// @param redeemer Address of the user whose Shares (Principals and Yields) are redeemed
    /// @param recipient Address of user that recieved Yield Bearing Tokens
    /// @param principalShareAmount Number of Tempus Principal Shares (TPS) to redeem into the Yield Bearing Token (YBT)
    /// @param yieldShareAmount Number of Tempus Yield Shares (TYS) to redeem into the Yield Bearing Token (YBT)
    /// @param yieldTokenAmount Number of Yield bearing tokens redeemed from the pool
    /// @param backingTokenValue Value of @param yieldTokenAmount expressed in backing tokens
    /// @param interestRate Interest Rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    /// @param fee The fee which was deducted (in terms of yield bearing tokens)
    /// @param isEarlyRedeem True in case of early redemption, otherwise false
    event Redeemed(
        address indexed pool,
        address indexed redeemer,
        address indexed recipient,
        uint256 principalShareAmount,
        uint256 yieldShareAmount,
        uint256 yieldTokenAmount,
        uint256 backingTokenValue,
        uint256 interestRate,
        uint256 fee,
        bool isEarlyRedeem
    );

    /// @dev Atomically deposits YBT/BT to TempusPool and provides liquidity
    ///      to the corresponding Tempus AMM with the issued TYS & TPS
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    function depositAndProvideLiquidity(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken
    ) external payable nonReentrant {
        _depositAndProvideLiquidity(tempusAMM, tokenAmount, isBackingToken);
    }

    /// @dev Atomically deposits YBT/BT to TempusPool and swaps TYS for TPS to get fixed yield
    ///      See https://docs.balancer.fi/developers/guides/single-swaps#swap-overview
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited as a Fixed18 decimal
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    /// @param minTYSRate Minimum exchange rate of TYS (denominated in TPS) to receive in exchange for TPS
    function depositAndFix(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken,
        uint256 minTYSRate
    ) external payable nonReentrant {
        _depositAndFix(tempusAMM, tokenAmount, isBackingToken, minTYSRate);
    }

    /// @dev Deposits Yield Bearing Tokens to a Tempus Pool.
    /// @param targetPool The Tempus Pool to which tokens will be deposited
    /// @param yieldTokenAmount amount of Yield Bearing Tokens to be deposited
    ///                         in YBT Contract precision which can be 18 or 8 decimals
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    function depositYieldBearing(
        ITempusPool targetPool,
        uint256 yieldTokenAmount,
        address recipient
    ) public nonReentrant {
        _depositYieldBearing(targetPool, yieldTokenAmount, recipient);
    }

    /// @dev Deposits Backing Tokens into the underlying protocol and
    ///      then deposited the minted Yield Bearing Tokens to the Tempus Pool.
    /// @param targetPool The Tempus Pool to which tokens will be deposited
    /// @param backingTokenAmount amount of Backing Tokens to be deposited into the underlying protocol
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    function depositBacking(
        ITempusPool targetPool,
        uint256 backingTokenAmount,
        address recipient
    ) public payable nonReentrant {
        _depositBacking(targetPool, backingTokenAmount, recipient);
    }

    /// @dev Redeem TPS+TYS held by msg.sender into Yield Bearing Tokens
    /// @notice `msg.sender` must approve Principals and Yields amounts to `targetPool`
    /// @notice `msg.sender` will receive yield bearing tokens
    /// @notice Before maturity, `principalAmount` must equal to `yieldAmount`
    /// @param targetPool The Tempus Pool from which to redeem Tempus Shares
    /// @param sender Address of user whose Shares are going to be redeemed
    /// @param principalAmount Amount of Tempus Principals to redeem as a Fixed18 decimal
    /// @param yieldAmount Amount of Tempus Yields to redeem as a Fixed18 decimal
    /// @param recipient Address of user that will recieve yield bearing tokens
    function redeemToYieldBearing(
        ITempusPool targetPool,
        address sender,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    ) public nonReentrant {
        _redeemToYieldBearing(targetPool, sender, principalAmount, yieldAmount, recipient);
    }

    /// @dev Redeem TPS+TYS held by msg.sender into Backing Tokens
    /// @notice `sender` must approve Principals and Yields amounts to this TempusPool
    /// @notice `recipient` will receive the backing tokens
    /// @notice Before maturity, `principalAmount` must equal to `yieldAmount`
    /// @param targetPool The Tempus Pool from which to redeem Tempus Shares
    /// @param sender Address of user whose Shares are going to be redeemed
    /// @param principalAmount Amount of Tempus Principals to redeem as a Fixed18 decimal
    /// @param yieldAmount Amount of Tempus Yields to redeem as a Fixed18 decimal
    /// @param recipient Address of user that will recieve yield bearing tokens
    function redeemToBacking(
        ITempusPool targetPool,
        address sender,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    ) public nonReentrant {
        _redeemToBacking(targetPool, sender, principalAmount, yieldAmount, recipient);
    }

    /// @dev Withdraws liquidity from TempusAMM
    /// @notice `msg.sender` needs to approve controller for @param lpTokensAmount of LP tokens
    /// @notice Transfers LP tokens to controller and exiting tempusAmm with `msg.sender` as recipient
    /// @param tempusAMM Tempus AMM instance
    /// @param lpTokensAmount Amount of LP tokens to be withdrawn
    /// @param principalAmountOutMin Minimal amount of TPS to be withdrawn
    /// @param yieldAmountOutMin Minimal amount of TYS to be withdrawn
    /// @param toInternalBalances Withdrawing liquidity to internal balances
    function exitTempusAMM(
        ITempusAMM tempusAMM,
        uint256 lpTokensAmount,
        uint256 principalAmountOutMin,
        uint256 yieldAmountOutMin,
        bool toInternalBalances
    ) external nonReentrant {
        _exitTempusAMM(tempusAMM, lpTokensAmount, principalAmountOutMin, yieldAmountOutMin, toInternalBalances);
    }

    /// @dev Withdraws liquidity from TempusAMM and redeems Shares to Yield Bearing or Backing Tokens
    ///      Checks user's balance of principal shares and yield shares
    ///      and exits AMM with exact amounts needed for redemption.
    /// @notice `msg.sender` needs to approve `tempusAMM.tempusPool` for both Yields and Principals
    ///         for `sharesAmount`
    /// @notice `msg.sender` needs to approve controller for whole balance of LP token
    /// @notice Transfers users' LP tokens to controller, then exits tempusAMM with `msg.sender` as recipient.
    ///         After exit transfers remainder of LP tokens back to user
    /// @notice Can fail if there is not enough user balance
    /// @notice Only available before maturity since exiting AMM with exact amounts is disallowed after maturity
    /// @param tempusAMM TempusAMM instance to withdraw liquidity from
    /// @param sharesAmount Amount of Principals and Yields
    /// @param toBackingToken If true redeems to backing token, otherwise redeems to yield bearing
    function exitTempusAMMAndRedeem(
        ITempusAMM tempusAMM,
        uint256 sharesAmount,
        bool toBackingToken
    ) external nonReentrant {
        _exitTempusAMMAndRedeem(tempusAMM, sharesAmount, toBackingToken);
    }

    /// @dev Withdraws ALL liquidity from TempusAMM and redeems Shares to Yield Bearing or Backing Tokens
    /// @notice `msg.sender` needs to approve controller for whole balance for both Yields and Principals
    /// @notice `msg.sender` needs to approve controller for whole balance of LP token
    /// @notice Can fail if there is not enough user balance
    /// @param tempusAMM TempusAMM instance to withdraw liquidity from
    /// @param maxLeftoverShares Maximum amount of Principals or Yields to be left in case of early exit
    /// @param toBackingToken If true redeems to backing token, otherwise redeems to yield bearing
    function completeExitAndRedeem(
        ITempusAMM tempusAMM,
        uint256 maxLeftoverShares,
        bool toBackingToken
    ) external nonReentrant {
        _completeExitAndRedeem(tempusAMM, maxLeftoverShares, toBackingToken);
    }

    /// Finalize the pool after maturity.
    function finalize(ITempusPool targetPool) external nonReentrant {
        targetPool.finalize();
    }

    /// @dev Returns amount that user needs to swap to end up with almost the same amounts of Principals and Yields
    /// @param tempusAMM TempusAMM instance to be used to query swap
    /// @param principals User's Principals balance
    /// @param yields User's Yields balance
    /// @param threshold Maximum difference between final balances of Principals and Yields
    /// @return amountIn Amount of Principals or Yields that user needs to swap to end with almost equal amounts
    function getSwapAmountToEndWithEqualShares(
        ITempusAMM tempusAMM,
        uint256 principals,
        uint256 yields,
        uint256 threshold
    ) public view returns (uint256 amountIn) {
        (uint256 difference, bool yieldsIn) = (principals > yields)
            ? (principals - yields, false)
            : (yields - principals, true);
        if (difference > threshold) {
            uint256 principalsRate = tempusAMM.tempusPool().principalShare().getPricePerFullShareStored();
            uint256 yieldsRate = tempusAMM.tempusPool().yieldShare().getPricePerFullShareStored();

            uint256 rate = yieldsIn ? principalsRate.divf18(yieldsRate) : yieldsRate.divf18(principalsRate);
            for (uint8 i = 0; i < 32; i++) {
                // if we have accurate rate this should hold
                amountIn = difference.divf18(rate + Fixed256x18.ONE);
                uint256 amountOut = tempusAMM.getExpectedReturnGivenIn(amountIn, yieldsIn);
                uint256 newPrincipals = yieldsIn ? (principals + amountOut) : (principals - amountIn);
                uint256 newYields = yieldsIn ? (yields - amountIn) : (yields + amountOut);
                uint256 newDifference = (newPrincipals > newYields)
                    ? (newPrincipals - newYields)
                    : (newYields - newPrincipals);
                if (newDifference < threshold) {
                    return amountIn;
                } else {
                    rate = amountOut.divf18(amountIn);
                }
            }
            revert("getSwapAmountToEndWithEqualShares did not converge.");
        }
    }

    /// @dev Performs Swap from tokenIn to tokenOut
    /// @notice sender needs to approve tempusAMM.getVault() for swapAmount of tokenIn
    /// @param tempusAMM TempusAMM instance to be used for Swap
    /// @param sender Address of user whose tokenIn tokens will be used for swap
    /// @param recipient Address of user that will recieve tokensOut
    /// @param swapAmount Amount of tokenIn to be swapped
    /// @param tokenIn Token that will be sent from user to the tempusAMM
    /// @param tokenOut Token that will be returned from the tempusAMM to the user
    /// @param minReturn Minimum amount of tokenOut that user will recieve
    function swap(
        ITempusAMM tempusAMM,
        address sender,
        address recipient,
        uint256 swapAmount,
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 minReturn
    ) public {
        require(swapAmount > 0, "Invalid swap amount.");

        (IVault vault, bytes32 poolId, , ) = _getAMMDetailsAndEnsureInitialized(tempusAMM);

        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: tokenIn,
            assetOut: tokenOut,
            amount: swapAmount,
            userData: ""
        });

        IVault.FundManagement memory fundManagement = IVault.FundManagement({
            sender: sender,
            fromInternalBalance: false,
            recipient: payable(recipient),
            toInternalBalance: false
        });
        vault.swap(singleSwap, fundManagement, minReturn, block.timestamp);
    }

    function _depositAndProvideLiquidity(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken
    ) private {
        (
            IVault vault,
            bytes32 poolId,
            IERC20[] memory ammTokens,
            uint256[] memory ammBalances
        ) = _getAMMDetailsAndEnsureInitialized(tempusAMM);

        ITempusPool targetPool = tempusAMM.tempusPool();
        _deposit(targetPool, tokenAmount, isBackingToken);

        uint256[2] memory ammDepositPercentages = ammBalances.getAMMBalancesRatio();
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
            userData: abi.encode(uint8(ITempusAMM.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT), ammLiquidityProvisionAmounts),
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

    function _depositAndFix(
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken,
        uint256 minTYSRate
    ) private {
        ITempusPool targetPool = tempusAMM.tempusPool();
        IERC20 principalShares = IERC20(address(targetPool.principalShare()));
        IERC20 yieldShares = IERC20(address(targetPool.yieldShare()));

        _deposit(targetPool, tokenAmount, isBackingToken);

        uint256 swapAmount = yieldShares.balanceOf(address(this));
        yieldShares.safeIncreaseAllowance(address(tempusAMM.getVault()), swapAmount);
        uint256 minReturn = swapAmount.mulf18(minTYSRate);
        swap(tempusAMM, address(this), address(this), swapAmount, yieldShares, principalShares, minReturn);

        // At this point all TYS must be swapped for TPS
        uint256 principalsBalance = principalShares.balanceOf(address(this));
        assert(principalsBalance > 0);
        assert(yieldShares.balanceOf(address(this)) == 0);

        principalShares.safeTransfer(msg.sender, principalsBalance);
    }

    function _deposit(
        ITempusPool targetPool,
        uint256 tokenAmount,
        bool isBackingToken
    ) private {
        if (isBackingToken) {
            _depositBacking(targetPool, tokenAmount, address(this));
        } else {
            _depositYieldBearing(targetPool, tokenAmount, address(this));
        }
    }

    function _depositYieldBearing(
        ITempusPool targetPool,
        uint256 yieldTokenAmount,
        address recipient
    ) private {
        require(yieldTokenAmount > 0, "yieldTokenAmount is 0");

        IERC20 yieldBearingToken = IERC20(targetPool.yieldBearingToken());

        // Deposit to controller and approve transfer from controller to targetPool
        uint transferredYBT = yieldBearingToken.untrustedTransferFrom(msg.sender, address(this), yieldTokenAmount);
        yieldBearingToken.safeIncreaseAllowance(address(targetPool), transferredYBT);

        // internal TempusPool takes Fixed18 amount
        uint transferredYBTf18 = targetPool.yieldTokenAmountToFixed18(transferredYBT);
        (uint mintedShares, uint depositedBT, uint fee, uint rate) = targetPool.deposit(transferredYBTf18, recipient);

        emit Deposited(
            address(targetPool),
            msg.sender,
            recipient,
            transferredYBT,
            depositedBT,
            mintedShares,
            rate,
            fee
        );
    }

    function _depositBacking(
        ITempusPool targetPool,
        uint256 backingTokenAmount,
        address recipient
    ) private {
        require(backingTokenAmount > 0, "backingTokenAmount is 0");

        IERC20 backingToken = IERC20(targetPool.backingToken());

        if (msg.value == 0) {
            backingTokenAmount = backingToken.untrustedTransferFrom(msg.sender, address(this), backingTokenAmount);
            backingToken.safeIncreaseAllowance(address(targetPool), backingTokenAmount);
        } else {
            require(address(backingToken) == address(0), "given TempusPool's Backing Token is not ETH");
        }

        (uint256 mintedShares, uint256 depositedYBT, uint256 fee, uint256 interestRate) = targetPool.depositBacking{
            value: msg.value
        }(backingTokenAmount, recipient);

        emit Deposited(
            address(targetPool),
            msg.sender,
            recipient,
            depositedYBT,
            backingTokenAmount,
            mintedShares,
            interestRate,
            fee
        );
    }

    function _redeemToYieldBearing(
        ITempusPool targetPool,
        address sender,
        uint256 principals,
        uint256 yields,
        address recipient
    ) private {
        require((principals > 0) || (yields > 0), "principalAmount and yieldAmount cannot both be 0");

        (uint redeemedYBT, uint fee, uint interestRate) = targetPool.redeem(sender, principals, yields, recipient);

        uint redeemedBT = targetPool.numAssetsPerYieldToken(redeemedYBT, targetPool.currentInterestRate());
        bool earlyRedeem = !targetPool.matured();
        emit Redeemed(
            address(targetPool),
            sender,
            recipient,
            principals,
            yields,
            redeemedYBT,
            redeemedBT,
            fee,
            interestRate,
            earlyRedeem
        );
    }

    function _redeemToBacking(
        ITempusPool targetPool,
        address sender,
        uint256 principals,
        uint256 yields,
        address recipient
    ) private {
        require((principals > 0) || (yields > 0), "principalAmount and yieldAmount cannot both be 0");

        (uint redeemedYBT, uint redeemedBT, uint fee, uint rate) = targetPool.redeemToBacking(
            sender,
            principals,
            yields,
            recipient
        );

        bool earlyRedeem = !targetPool.matured();
        emit Redeemed(
            address(targetPool),
            sender,
            recipient,
            principals,
            yields,
            redeemedYBT,
            redeemedBT,
            fee,
            rate,
            earlyRedeem
        );
    }

    function _exitTempusAMM(
        ITempusAMM tempusAMM,
        uint256 lpTokensAmount,
        uint256 principalAmountOutMin,
        uint256 yieldAmountOutMin,
        bool toInternalBalances
    ) private {
        require(tempusAMM.transferFrom(msg.sender, address(this), lpTokensAmount), "LP token transfer failed");

        ITempusPool tempusPool = tempusAMM.tempusPool();
        uint256[] memory amounts = getAMMOrderedAmounts(tempusPool, principalAmountOutMin, yieldAmountOutMin);
        _exitTempusAMMGivenLP(tempusAMM, address(this), msg.sender, lpTokensAmount, amounts, toInternalBalances);

        assert(tempusAMM.balanceOf(address(this)) == 0);
    }

    function _exitTempusAMMGivenLP(
        ITempusAMM tempusAMM,
        address sender,
        address recipient,
        uint256 lpTokensAmount,
        uint256[] memory minAmountsOut,
        bool toInternalBalances
    ) private {
        require(lpTokensAmount > 0, "LP token amount is 0");

        (IVault vault, bytes32 poolId, IERC20[] memory ammTokens, ) = _getAMMDetailsAndEnsureInitialized(tempusAMM);

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            assets: ammTokens,
            minAmountsOut: minAmountsOut,
            userData: abi.encode(uint8(ITempusAMM.ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT), lpTokensAmount),
            toInternalBalance: toInternalBalances
        });
        vault.exitPool(poolId, sender, payable(recipient), request);
    }

    function _exitTempusAMMGivenAmountsOut(
        ITempusAMM tempusAMM,
        address sender,
        address recipient,
        uint256[] memory amountsOut,
        uint256 lpTokensAmountInMax,
        bool toInternalBalances
    ) private {
        (IVault vault, bytes32 poolId, IERC20[] memory ammTokens, ) = _getAMMDetailsAndEnsureInitialized(tempusAMM);

        IVault.ExitPoolRequest memory request = IVault.ExitPoolRequest({
            assets: ammTokens,
            minAmountsOut: amountsOut,
            userData: abi.encode(
                uint8(ITempusAMM.ExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT),
                amountsOut,
                lpTokensAmountInMax
            ),
            toInternalBalance: toInternalBalances
        });
        vault.exitPool(poolId, sender, payable(recipient), request);
    }

    function _exitTempusAMMAndRedeem(
        ITempusAMM tempusAMM,
        uint256 sharesAmount,
        bool toBackingToken
    ) private {
        ITempusPool tempusPool = tempusAMM.tempusPool();
        require(!tempusPool.matured(), "Pool already finalized");
        uint256 userPrincipalBalance = IERC20(address(tempusPool.principalShare())).balanceOf(msg.sender);
        uint256 userYieldBalance = IERC20(address(tempusPool.yieldShare())).balanceOf(msg.sender);

        uint256 ammExitAmountPrincipal = sharesAmount - userPrincipalBalance;
        uint256 ammExitAmountYield = sharesAmount - userYieldBalance;

        // transfer LP tokens to controller
        uint256 userBalanceLP = tempusAMM.balanceOf(msg.sender);
        require(tempusAMM.transferFrom(msg.sender, address(this), userBalanceLP), "LP token transfer failed");

        uint256[] memory amounts = getAMMOrderedAmounts(tempusPool, ammExitAmountPrincipal, ammExitAmountYield);
        _exitTempusAMMGivenAmountsOut(tempusAMM, address(this), msg.sender, amounts, userBalanceLP, false);

        // transfer remainder of LP tokens back to user
        uint256 lpTokenBalance = tempusAMM.balanceOf(address(this));
        require(tempusAMM.transferFrom(address(this), msg.sender, lpTokenBalance), "LP token transfer failed");

        if (toBackingToken) {
            _redeemToBacking(tempusPool, msg.sender, sharesAmount, sharesAmount, msg.sender);
        } else {
            _redeemToYieldBearing(tempusPool, msg.sender, sharesAmount, sharesAmount, msg.sender);
        }
    }

    function _completeExitAndRedeem(
        ITempusAMM tempusAMM,
        uint256 maxLeftoverShares,
        bool toBackingToken
    ) private {
        ITempusPool tempusPool = tempusAMM.tempusPool();

        IERC20 principalShare = IERC20(address(tempusPool.principalShare()));
        IERC20 yieldShare = IERC20(address(tempusPool.yieldShare()));
        // send all shares to controller
        principalShare.safeTransferFrom(msg.sender, address(this), principalShare.balanceOf(msg.sender));
        yieldShare.safeTransferFrom(msg.sender, address(this), yieldShare.balanceOf(msg.sender));

        uint256 userBalanceLP = tempusAMM.balanceOf(msg.sender);

        if (userBalanceLP > 0) {
            // if there is LP balance, transfer to controller
            require(tempusAMM.transferFrom(msg.sender, address(this), userBalanceLP), "LP token transfer failed");

            uint256[] memory minAmountsOut = new uint256[](2);

            // exit amm and sent shares to controller
            _exitTempusAMMGivenLP(tempusAMM, address(this), address(this), userBalanceLP, minAmountsOut, false);
        }

        uint256 principals = principalShare.balanceOf(address(this));
        uint256 yields = yieldShare.balanceOf(address(this));

        if (!tempusPool.matured()) {
            bool yieldsIn = yields > principals;
            uint256 difference = yieldsIn ? (yields - principals) : (principals - yields);

            if (difference >= maxLeftoverShares) {
                uint amountIn = getSwapAmountToEndWithEqualShares(tempusAMM, principals, yields, maxLeftoverShares);
                (IERC20 tokenIn, IERC20 tokenOut) = yieldsIn
                    ? (yieldShare, principalShare)
                    : (principalShare, yieldShare);
                tokenIn.safeIncreaseAllowance(address(tempusAMM.getVault()), amountIn);

                swap(tempusAMM, address(this), address(this), amountIn, tokenIn, tokenOut, 0);

                principals = principalShare.balanceOf(address(this));
                yields = yieldShare.balanceOf(address(this));

                (yields, principals) = (principals <= yields) ? (principals, principals) : (yields, yields);
            }
        }

        if (toBackingToken) {
            _redeemToBacking(tempusPool, address(this), principals, yields, msg.sender);
        } else {
            _redeemToYieldBearing(tempusPool, address(this), principals, yields, msg.sender);
        }
    }

    function _getAMMDetailsAndEnsureInitialized(ITempusAMM tempusAMM)
        private
        view
        returns (
            IVault vault,
            bytes32 poolId,
            IERC20[] memory ammTokens,
            uint256[] memory ammBalances
        )
    {
        vault = tempusAMM.getVault();
        poolId = tempusAMM.getPoolId();
        (ammTokens, ammBalances, ) = vault.getPoolTokens(poolId);
        require(
            ammTokens.length == 2 && ammBalances.length == 2 && ammBalances[0] > 0 && ammBalances[1] > 0,
            "AMM not initialized"
        );
    }

    function getAMMOrderedAmounts(
        ITempusPool tempusPool,
        uint256 principalAmount,
        uint256 yieldAmount
    ) private view returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](2);
        (amounts[0], amounts[1]) = (tempusPool.principalShare() < tempusPool.yieldShare())
            ? (principalAmount, yieldAmount)
            : (yieldAmount, principalAmount);
        return amounts;
    }
}
