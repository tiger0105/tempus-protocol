import { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { ONE_WEI, toWei } from "./utils/Decimal";
import { TempusAMM, TempusAMMJoinKind } from "./utils/TempusAMM"
import { ContractBase } from "./utils/ContractBase";
import { blockTimestamp, expectRevert } from "./utils/Utils";
import { Aave } from "./utils/Aave";
import { generateTempusSharesNames, TempusPool } from "./utils/TempusPool";

const SWAP_LIMIT_ERROR_MESSAGE = "BAL#507";

const setup = deployments.createFixture(async () => {
    await deployments.fixture(undefined, {
      keepExistingDeployments: true, // global option to test network like that
    });

    const ammAmplification = 5;
    const ammFee = 0.02;
  
    const [owner, user] = await ethers.getSigners();

    const aavePool = await Aave.create(100000000);
    await aavePool.asset.transfer(owner, user, 1000000);
    await aavePool.asset.approve(owner, aavePool.address, 1000000);
    await aavePool.asset.approve(user, aavePool.address, 1000000);
    await aavePool.deposit(owner, 1000000);
    await aavePool.deposit(user, 1000000);

    const aavePool1 = await Aave.create(1000000);

    const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr

    const names = generateTempusSharesNames("aToken", "aTKN", maturityTime);
    const tempusPool = await TempusPool.deploy(aavePool.yieldToken, aavePool.priceOracle, maturityTime, names);
    const tempusPool1 = await TempusPool.deploy(aavePool1.yieldToken, aavePool1.priceOracle, maturityTime, names);

    const tempusAMM = await TempusAMM.create(owner, ammAmplification, ammFee, tempusPool.principalShare, tempusPool.yieldShare);
    
    const tempusController = await ContractBase.deployContract('TempusController');
    await aavePool.yieldToken.approve(owner, tempusController.address, 1000000);
    await aavePool.yieldToken.approve(user, tempusController.address, 1000000);

    await aavePool.setLiquidityIndex(1.1);

    return {
      contracts: {
        aavePool, 
        aavePool1,
        tempusPool,
        tempusPool1,
        tempusAMM,
        tempusController
      },
      signers: {
        owner,
        user
      }
    };
  });

describe("TempusController", async () => {
    // TODO: refactor math (minimize toWei, fromWei, Number etc...). I think we should just use Decimal.js
    describe("depositYBTAndProvideLiquidity", async () => {
      it("deposit YBT and provide liquidity to a pre-initialized AMM", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 1234.5678912, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositYBTAndProvideLiquidity(
            tempusPool.address,
            tempusAMM.address,
            toWei(5234.456789)
        ); 

        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        const controllerPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusController.address);
        const controllerYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusController.address);
        const vaultPrincipalShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const postDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePostDeposit)).div(toWei(vaultYieldShareBalancePostDeposit));
        
        // Makes sure AMM balances maintain the same ratio
        expect(postDepositAMMBalancesRatio.toString()).to.equal(preDepositAMMBalancesRatio.toString());
        
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);

        // makes sure no funds are left in the controller
        expect(controllerPrincpialShareBalancePostDeposit).to.be.equal(0);
        expect(controllerYieldShareBalancePostDeposit).to.be.equal(0);
      });

      it("deposit YBT and provide liquidity to a pre-initialized AMM with more then 100% yield estimate", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);

        aavePool.setLiquidityIndex(10.0);

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 123.45678, 1.2345678, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositYBTAndProvideLiquidity(
            tempusPool.address,
            tempusAMM.address,
            toWei(5234.456789)
        ); 

        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        const controllerPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusController.address);
        const controllerYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusController.address);
        const vaultPrincipalShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const postDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePostDeposit)).div(toWei(vaultYieldShareBalancePostDeposit));
        
        // Makes sure AMM balances maintain the same ratio
        expect(postDepositAMMBalancesRatio.toString()).to.equal(preDepositAMMBalancesRatio.toString());
        
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.greaterThan(0);

        // makes sure no funds are left in the controller
        expect(controllerPrincpialShareBalancePostDeposit).to.be.equal(0);
        expect(controllerYieldShareBalancePostDeposit).to.be.equal(0);
      });

      it("verifies depositing YBT and providing liquidity to a non initialized AMM reverts", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();
        
        const invalidAction = tempusController.connect(user).depositYBTAndProvideLiquidity(
            tempusPool.address,
            tempusAMM.address,
            toWei(123)
        );
        (await expectRevert(invalidAction)).to.equal("AMM not initialized");
      });

      it("verifies depositing 0 tokens and providing liquidity reverts", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();
        
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 1234.5678912, TempusAMMJoinKind.INIT);
        
        const invalidAction = tempusController.connect(user).depositYBTAndProvideLiquidity(
            tempusPool.address,
            tempusAMM.address,
            0
        );
        (await expectRevert(invalidAction)).to.equal("yieldTokenAmount is 0");
      });

      it("verifies depositing and providing liquidity reverts in case of mixed tokens", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();
        
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 1234.5678912, TempusAMMJoinKind.INIT);
        
        const invalidAction = tempusController.connect(user).depositYBTAndProvideLiquidity(
            tempusPool1.address,
            tempusAMM.address,
            1
        );
        (await expectRevert(invalidAction)).to.equal("TempusPool does not contain given token/s");
      });
    });

    describe("depositYBTAndFix", async () => {
      it("verifies tx reverts if provided minimum TYS rate requirement is not met", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();
        const minTYSRate = toWei("0.10000001"); // 10.000001%

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 200, 2000, TempusAMMJoinKind.INIT); // 10% rate
  
        const invalidAction = tempusController.connect(user).depositYBTAndFix(
            tempusPool.address,
            tempusAMM.address,
            toWei(5.456789),
            minTYSRate
        ); 
  
        (await expectRevert(invalidAction)).to.equal(SWAP_LIMIT_ERROR_MESSAGE);
      });

      it("verifies tx succeeds if provided minimum TYS rate requirement is met", async () => {
        const { contracts: { aavePool, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setup();
        const minTYSRate = toWei("0.097"); // 9.7% (fee + slippage)
        
        const userPrincpialShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(user);
        expect(Number(userPrincpialShareBalancePreDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePreDeposit)).to.be.equal(0);
        
        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 200, 2000, TempusAMMJoinKind.INIT); // 10% rate
  
        await tempusController.connect(user).depositYBTAndFix(
            tempusPool.address,
            tempusAMM.address,
            toWei(5.456789),
            minTYSRate
        ); 

        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });
    });
});
