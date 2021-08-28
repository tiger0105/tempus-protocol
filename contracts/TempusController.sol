// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";
import "./math/Fixed256x18.sol";
import "./utils/PermanentlyOwnable.sol";

contract TempusController is PermanentlyOwnable {
    using Fixed256x18 for uint256;
    using SafeERC20 for IERC20;

    /// @dev Event emitted on a successful BT/YBT deposit.
    /// @param pool The Tempus Pool to which assets were deposited
    /// @param depositor Address of user who deposits Yield Bearing Tokens to mint
    ///                  Tempus Principal Share (TPS) and Tempus Yield Shares
    /// @param recipient Address of the recipient who will receive TPS and TYS tokens
    /// @param yieldTokenAmount Amount of yield tokens received from underlying pool
    /// @param backingTokenValue Value of @param yieldTokenAmount expressed in backing tokens
    /// @param shareAmounts Number of Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS) granted to `recipient`
    /// @param interestRate Interest Rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    event Deposited(
        address indexed pool,
        address indexed depositor,
        address indexed recipient,
        uint256 yieldTokenAmount,
        uint256 backingTokenValue,
        uint256 shareAmounts,
        uint256 interestRate
    );

    /// @dev Event emitted on a successful BT/YBT redemption.
    /// @param pool The Tempus Pool from which Tempus Shares were redeemed
    /// @param redeemer Address of the user who wants to redeem Tempus Principal Shares (TPS)
    ///                 and Tempus Yield Shares (TYS) to Yield Bearing Tokens (YBT).
    /// @param principalShareAmount Number of Tempus Principal Shares (TPS) to redeem into the Yield Bearing Token (YBT)
    /// @param yieldShareAmount Number of Tempus Yield Shares (TYS) to redeem into the Yield Bearing Token (YBT)
    /// @param yieldBearingAmount Number of Yield bearing tokens redeemed from the pool
    /// @param backingTokenValue Value of @param yieldBearingAmount expressed in backing tokens
    /// @param interestRate Interest Rate of the underlying pool from Yield Bearing Tokens to the underlying asset
    event Redeemed(
        address indexed pool,
        address indexed redeemer,
        uint256 principalShareAmount,
        uint256 yieldShareAmount,
        uint256 yieldBearingAmount,
        uint256 backingTokenValue,
        uint256 interestRate
    );

    // TODO: we need to add a reference to ITempusPool in TempusAMM... This would also mean the we can remove the ITempusPool argument

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
            depositBacking(targetPool, tokenAmount, address(this));
        } else {
            depositYieldBearing(targetPool, tokenAmount, address(this));
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
    ///      See https://docs.balancer.fi/developers/guides/single-swaps#swap-overview
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
            depositBacking(targetPool, tokenAmount, address(this));
        } else {
            depositYieldBearing(targetPool, tokenAmount, address(this));
        }

        IERC20 principalShares = IERC20(address(targetPool.principalShare()));
        IERC20 yieldShares = IERC20(address(targetPool.yieldShare()));
        uint256 swapAmount = yieldShares.balanceOf(address(this));
        yieldShares.safeIncreaseAllowance(address(vault), swapAmount);

        // Provide TPS/TYS liquidity to TempusAMM
        IVault.SingleSwap memory singleSwap = IVault.SingleSwap({
            poolId: poolId,
            kind: IVault.SwapKind.GIVEN_IN,
            assetIn: yieldShares,
            assetOut: principalShares,
            amount: swapAmount,
            userData: ""
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

    /// @dev Deposits Yield Bearing Tokens to a Tempus Pool.
    /// @param targetPool The Tempus Pool to which tokens will be deposited
    /// @param yieldTokenAmount amount of Yield Bearing Tokens to be deposited
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    function depositYieldBearing(
        ITempusPool targetPool,
        uint256 yieldTokenAmount,
        address recipient
    ) public {
        require(yieldTokenAmount > 0, "yieldTokenAmount is 0");

        IERC20 yieldBearingToken = IERC20(targetPool.yieldBearingToken());

        // Deposit to TempusPool
        yieldBearingToken.safeTransferFrom(msg.sender, address(this), yieldTokenAmount);
        yieldBearingToken.safeIncreaseAllowance(address(targetPool), yieldTokenAmount);
        (uint256 mintedShares, uint256 depositedBT, uint256 interestRate) = targetPool.deposit(
            yieldTokenAmount,
            recipient
        );

        emit Deposited(
            address(targetPool),
            msg.sender,
            recipient,
            yieldTokenAmount,
            depositedBT,
            mintedShares,
            interestRate
        );
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
    ) public payable {
        require(backingTokenAmount > 0, "backingTokenAmount is 0");
        IERC20 backingToken = IERC20(targetPool.backingToken());

        if (msg.value == 0) {
            backingToken.safeTransferFrom(msg.sender, address(this), backingTokenAmount);
            backingToken.safeIncreaseAllowance(address(targetPool), backingTokenAmount);
        } else {
            require(address(backingToken) == address(0), "given TempusPool's Backing Token is not ETH");
        }

        (uint256 mintedShares, uint256 depositedYBT, uint256 interestRate) = targetPool.depositBacking{
            value: msg.value
        }(backingTokenAmount, recipient);

        emit Deposited(
            address(targetPool),
            msg.sender,
            recipient,
            depositedYBT,
            backingTokenAmount,
            mintedShares,
            interestRate
        );
    }

    /// @dev Redeem TPS+TYS held by msg.sender into Yield Bearing Tokens
    ///      `msg.sender` must approve TPS and TYS amounts to this TempusPool.
    ///      `msg.sender` will receive the backing tokens
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param targetPool The Tempus Pool from which to redeem Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem
    function redeemToYieldBearing(
        ITempusPool targetPool,
        uint256 principalAmount,
        uint256 yieldAmount
    ) public {
        require(principalAmount > 0, "principalAmount is 0");
        require(yieldAmount > 0, "yieldAmount is 0");

        (uint256 redeemedYBT, uint256 redeemedBT, uint256 interestRate) = targetPool.redeem(
            msg.sender,
            principalAmount,
            yieldAmount,
            msg.sender
        );

        emit Redeemed(
            address(targetPool),
            msg.sender,
            principalAmount,
            yieldAmount,
            redeemedYBT,
            redeemedBT,
            interestRate
        );
    }

    /// @dev Redeem TPS+TYS held by msg.sender into Backing Tokens
    ///      `msg.sender` must approve TPS and TYS amounts to this TempusPool.
    ///      `msg.sender` will receive the backing tokens
    ///      NOTE Before maturity, principalAmount must equal to yieldAmount.
    /// @param targetPool The Tempus Pool from which to redeem Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem
    function redeemToBacking(
        ITempusPool targetPool,
        uint256 principalAmount,
        uint256 yieldAmount
    ) public {
        require(principalAmount > 0, "principalAmount is 0");
        require(yieldAmount > 0, "yieldAmount is 0");

        (uint256 redeemedYBT, uint256 redeemedBT, uint256 interestRate) = targetPool.redeemToBacking(
            msg.sender,
            principalAmount,
            yieldAmount,
            msg.sender
        );

        emit Redeemed(
            address(targetPool),
            msg.sender,
            principalAmount,
            yieldAmount,
            redeemedYBT,
            redeemedBT,
            interestRate
        );
    }

    function getAMMBalancesRatio(uint256[] memory ammBalances) private pure returns (uint256[2] memory balancesRatio) {
        uint256 rate = ammBalances[0].divf18(ammBalances[1]);

        (balancesRatio[0], balancesRatio[1]) = rate > Fixed256x18.ONE
            ? (Fixed256x18.ONE, Fixed256x18.ONE.divf18(rate))
            : (rate, Fixed256x18.ONE);
    }
}
