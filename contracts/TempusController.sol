// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./amm/interfaces/ITempusAMM.sol";
import "./amm/interfaces/IVault.sol";
import "./ITempusPool.sol";
import "./math/Fixed256x18.sol";
import "./factories/ITempusPoolFactory.sol";

contract TempusController is Ownable {
    using Fixed256x18 for uint256;
    using SafeERC20 for IERC20;

    /// event emitted on TempusPool deployment
    /// @param pool tempus pool just deployed
    /// @param yieldToken yield bearing token in underlying protocol
    /// @param backingToken backing token for @param yieldToken
    /// @param maturity maturity time
    event TempusPoolDeployed(ITempusPool pool, address yieldToken, address backingToken, uint256 maturity);

    mapping(bytes32 => ITempusPoolFactory) private factories;

    // TODO: we need to add a reference to ITempusPool in TempusAMM... This would also mean the we can remove the ITempusPool argument

    /// @dev Atomically deposits YBT/BT to TempusPool and provides liquidity
    ///      to the corresponding Tempus AMM with the issued TYS & TPS
    /// @param targetPool Tempus Pool to which YBT/BT will be deposited
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    function depositAndProvideLiquidity(
        ITempusPool targetPool,
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken
    ) external payable {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();
        (IERC20[] memory ammTokens, uint256[] memory ammBalances, ) = vault.getPoolTokens(poolId);

        ensureTempusPoolContainsTokens(targetPool, ammTokens);
        require(ammBalances[0] > 0 && ammBalances[1] > 0, "AMM not initialized");

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
    /// @param targetPool Tempus Pool to which assets will be deposited
    /// @param tempusAMM Tempus AMM to use to swap TYS for TPS
    /// @param tokenAmount Amount of YBT/BT to be deposited
    /// @param isBackingToken specifies whether the deposited asset is the Backing Token or Yield Bearing Token
    /// @param minTYSRate Minimum TYS rate (denominated in TPS) to receive in exchange to TPS
    function depositAndFix(
        ITempusPool targetPool,
        ITempusAMM tempusAMM,
        uint256 tokenAmount,
        bool isBackingToken,
        uint256 minTYSRate
    ) external payable {
        IVault vault = tempusAMM.getVault();
        bytes32 poolId = tempusAMM.getPoolId();
        (IERC20[] memory ammTokens, , ) = vault.getPoolTokens(poolId);

        ensureTempusPoolContainsTokens(targetPool, ammTokens);

        if (isBackingToken) {
            depositBackingTokens(targetPool, tokenAmount);
        } else {
            depositYieldBearingTokens(targetPool, tokenAmount);
        }

        IERC20 principalShares = IERC20(targetPool.principalShare());
        IERC20 yieldShares = IERC20(targetPool.yieldShare());
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

        (balancesRatio[0], balancesRatio[1]) = rate > Fixed256x18.ONE
            ? (Fixed256x18.ONE, Fixed256x18.ONE.divf18(rate))
            : (rate, Fixed256x18.ONE);
    }

    function addFactory(ITempusPoolFactory factory) external onlyOwner {
        require(factory.protocol() != bytes32(0), "Invalid protocol name!");
        factories[factory.protocol()] = factory;
    }

    function deployTempusPool(
        bytes32 protocol,
        address token,
        uint256 maturity,
        uint256 estYield,
        string memory principalName,
        string memory principalSymbol,
        string memory yieldName,
        string memory yieldSymbol
    ) external returns (ITempusPool tempusPool) {
        ITempusPoolFactory factory = factories[protocol];
        require(factory != ITempusPoolFactory(address(0)), "Protocol not supported!");

        tempusPool = factory.deployPool(
            token,
            maturity,
            estYield,
            principalName,
            principalSymbol,
            yieldName,
            yieldSymbol
        );

        emit TempusPoolDeployed(tempusPool, token, tempusPool.backingToken(), maturity);
    }
}
