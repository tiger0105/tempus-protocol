import { expect } from "chai";
import { ONE_WEI, toWei } from "./utils/Decimal";
import { Signer } from "./utils/ContractBase";
import { TempusAMM, TempusAMMJoinKind } from "./utils/TempusAMM";
import { expectRevert } from "./utils/Utils";
import { PoolType, TempusPool } from "./utils/TempusPool";
import { TempusController } from "./utils/TempusController";
import { describeForEachPool, describeForEachPoolType } from "./pool-utils/MultiPoolTestSuite";
import { ITestPool } from "./pool-utils/ITestPool";
import { BigNumber } from "@ethersproject/bignumber";

const SWAP_LIMIT_ERROR_MESSAGE = "BAL#507";

describeForEachPool("TempusController", (testPool:ITestPool) =>
{
  let owner:Signer, user1:Signer, user2:Signer;
  let pool:TempusPool;
  let amm:TempusAMM;
  let controller:TempusController;

  beforeEach(async () =>
  {
    pool = await testPool.createDefault();
    [owner, user1, user2] = testPool.signers;

    amm = testPool.amm;
    controller = testPool.tempus.controller;
    await testPool.setupAccounts(owner, [[user1,/*ybt*/1000000],[user2,/*ybt*/100000]]);
  });

  // TODO: refactor math (minimize toWei, fromWei, Number etc...). I think we should just use Decimal.js
  async function getAMMBalancesRatio(): Promise<BigNumber>
  {
    const principals = await pool.principalShare.balanceOf(amm.vault.address);
    const yields = await pool.yieldShare.balanceOf(amm.vault.address);
    return ONE_WEI.mul(toWei(principals)).div(toWei(yields));
  }

  // pre-initialize AMM liquidity
  async function initAMM(user:Signer, ybtDeposit:number, principals:number, yields:number)
  {
    await controller.depositYieldBearing(user, pool, ybtDeposit, user);
    await amm.provideLiquidity(user1, principals, yields, TempusAMMJoinKind.INIT);
  }

  async function expectValidState(expectedAMMBalancesRatio:BigNumber = null)
  {
    if (expectedAMMBalancesRatio) {
      expect(await getAMMBalancesRatio()).to.equal(expectedAMMBalancesRatio, "AMM balances must maintain the same ratio");
    }
    expect(+await pool.principalShare.balanceOf(controller.address)).to.equal(0, "No funds should remain in controller");
    expect(+await pool.yieldShare.balanceOf(controller.address)).to.equal(0, "No funds should remain in controller");
  }

  describe("depositAndProvideLiquidity", () =>
  {
    it("deposit YBT and provide liquidity to a pre-initialized AMM", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1200, /*principals*/120, /*yields*/1200);

      const ratioBefore = await getAMMBalancesRatio();
      await controller.depositAndProvideLiquidity(testPool, user2, 500, /*isBackingToken:*/false);
      await expectValidState(ratioBefore);
      
      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("deposit BT and provide liquidity to a pre-initialized AMM", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/100, /*principals*/1.2, /*yields*/12);

      const ratioBefore = await getAMMBalancesRatio();
      const ethAmount = testPool.type == PoolType.Lido ? 50 : 0;
      await controller.depositAndProvideLiquidity(testPool, user2, 50, true, ethAmount);
      await expectValidState(ratioBefore);

      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("deposit YBT and provide liquidity to a pre-initialized AMM with more then 100% yield estimate", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1200, /*principals*/120, /*yields*/12);
      await testPool.setInterestRate(10.0);

      const ratioBefore = await getAMMBalancesRatio();
      await controller.depositAndProvideLiquidity(testPool, user2, 100, false); 
      await expectValidState(ratioBefore);

      expect(+await amm.balanceOf(user2)).to.be.greaterThan(0, "pool tokens must be issued to the user");
      expect(+await pool.principalShare.balanceOf(user2)).to.be.equal(0, "ALL Principals should be deposited to AMM");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.greaterThan(0, "Some Yields should be returned to user");
    });

    it("verifies depositing YBT and providing liquidity to a non initialized AMM reverts", async () =>
    {
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user1, 123, false);
      (await expectRevert(invalidAction)).to.equal("AMM not initialized");
    });

    it("verifies depositing ERC20 BT and providing liquidity to a non initialized AMM reverts", async () =>
    {
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user1, 123, true);
      (await expectRevert(invalidAction)).to.equal("AMM not initialized");
    });

    it("verifies depositing 0 YBT and providing liquidity reverts", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/12.34567, /*yields*/1234.5678912);
      const invalidAction = controller.depositAndProvideLiquidity(testPool, user2, 0, false);
      (await expectRevert(invalidAction)).to.equal("yieldTokenAmount is 0");
    });
  });

  describe("depositAndFix", () =>
  {
    it("verifies tx reverts if provided minimum TYS rate requirement is not met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/200, /*yields*/2000); // 10% rate
      const minTYSRate = "0.11000001"; // 10.000001%
      const invalidAction = controller.depositAndFix(testPool, user2, 5.456789, false, minTYSRate); 

      (await expectRevert(invalidAction)).to.equal(SWAP_LIMIT_ERROR_MESSAGE);
    });

    it("verifies depositing YBT succeeds if provided minimum TYS rate requirement is met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/200, /*yields*/2000); // 10% rate
      const minTYSRate = "0.097"; // 9.7% (fee + slippage)
      await controller.depositAndFix(testPool, user2, 5.456789, false, minTYSRate); 
      await expectValidState();

      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });

    it("verifies depositing BT succeeds if provided minimum TYS rate requirement is met", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/2000, /*principals*/20, /*yields*/200); // 10% rate
      const minTYSRate = "0.097"; // 9.7% (fee + slippage)
      const amount = 5.456789;
      const ethAmount = testPool.type == PoolType.Lido ? amount : 0;
      await controller.depositAndFix(testPool, user2, 5.456789, true, minTYSRate, ethAmount); 
      await expectValidState();

      expect(+await pool.principalShare.balanceOf(user2)).to.be.greaterThan(0, "Some Principals should be returned to user");
      expect(+await pool.yieldShare.balanceOf(user2)).to.be.equal(0, "ALL Yields should be deposited to AMM");
    });
  });

  describe("Exit AMM", () =>
  {
    it("ExitAMM before maturity", async () =>
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      const beforeExitBalanceLP:number = +await testPool.amm.balanceOf(user1);
      expect(beforeExitBalanceLP).to.be.within(181000, 182000);
      await testPool.setInterestRate(1.1);
      await testPool.fastForwardToMaturity();
      await controller.exitTempusAmm(testPool, user1, 100000);
      expect(+await testPool.amm.balanceOf(user1)).to.be.within(81000, 82000);
      expect(+await testPool.tempus.yieldShare.balanceOf(user1)).to.be.within(550000, 551000);
      expect(+await testPool.tempus.principalShare.balanceOf(user1)).to.be.within(955000, 956000);
    });
  });

  describe("Exit AMM and Reedem", () => 
  {
    it("Exit AMM and redeem before maturity", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);

      await controller.depositYieldBearing(user2, pool, 10000, user2);
      await testPool.amm.provideLiquidity(user2, 1000, 10000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
      await controller.exitTempusAMMAndRedeem(testPool, user2, 9999, false);
      expect(await pool.yieldShare.balanceOf(user2)).to.equal(0);
      expect(await pool.principalShare.balanceOf(user2)).to.equal(0);
      expect(+await amm.balanceOf(user2)).to.be.within(0.991, 0.993);
      expect(await pool.yieldBearing.balanceOf(user2)).to.equal(99999);
    });

    it("Exit AMM and redeem to backing before maturity", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      await controller.depositYieldBearing(user2, pool, 10000, user2);
      await testPool.amm.provideLiquidity(user2, 1000, 10000, TempusAMMJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT);
      const reedemAction = controller.exitTempusAMMAndRedeem(testPool, user2, 9999, true);
      if (testPool.type === PoolType.Lido) {
        (await expectRevert(reedemAction)).to.equal("LidoTempusPool.withdrawFromUnderlyingProtocol not supported");
      }
      else {
        await reedemAction;
        expect(await pool.yieldShare.balanceOf(user2)).to.equal(0);
        expect(await pool.principalShare.balanceOf(user2)).to.equal(0);
        expect(+await amm.balanceOf(user2)).to.be.within(0.991, 0.993);
        expect(await testPool.asset().balanceOf(user2)).to.equal(109999);
      }
    });

    it("Exit AMM and redeem after maturity should revert", async () => 
    {
      await initAMM(user1, /*ybtDeposit*/1000000, /*principals*/100000, /*yields*/1000000);
      await testPool.fastForwardToMaturity();

      (await expectRevert(controller.exitTempusAMMAndRedeem(testPool, user2, 100000, false))).to.equal(
        "Pool already finalized"
      );
    });
  });
});
