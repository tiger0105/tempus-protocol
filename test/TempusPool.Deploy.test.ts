
import { ethers } from "hardhat";
import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

import { Signer } from "./utils/ContractBase";
import { TempusPool } from "./utils/TempusPool";
import { expectRevert, blockTimestamp, increaseTime } from "./utils/Utils";

describeForEachPool("TempusPool Deploy", async (testPool:ITestPool) =>
{
  let owner:Signer, user:Signer, user2:Signer;
  let pool:TempusPool;

  beforeEach(async () =>
  {
    [owner, user, user2] = await ethers.getSigners();
    pool = await testPool.createTempusPool(owner, user);
  });

  describe("Deploy", async () =>
  {
    it("Version is correct", async () =>
    {
      expect(await pool.version()).to.equal(1);
    });

    it("Start and maturity time", async () =>
    {
      expect(await pool.startTime()).to.lte(await blockTimestamp());
      expect(await pool.maturityTime()).to.equal(testPool.maturityTime);
    });

    it("Maturity should not be set", async () =>
    {
      expect(await pool.matured()).to.equal(false);
    });

    it("Exchange rates should be set", async () =>
    {
      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(1.0);
      expect(await pool.maturityExchangeRate()).to.equal(0.0);
    });

    it("Finalize prior to maturity", async () =>
    {
      (await expectRevert(pool.finalize())).to.equal("Maturity not been reached yet.");
    });

    it("Finalize on/after maturity", async () =>
    {
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
    });

    it("Finalizing multiple times", async () =>
    {
      (await expectRevert(pool.finalize())).to.equal("Maturity not been reached yet.");
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
      await pool.finalize();
      await pool.finalize();
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
    });

    it("Principal shares initial details", async () =>
    {
      expect(await pool.principalShare.totalSupply()).to.equal(0);
      expect(await pool.principalShare.name()).to.equal(testPool.principalName);
      expect(await pool.principalShare.symbol()).to.equal(testPool.principalName);
    });

    it("Yield shares initial details", async () =>
    {
      expect(await pool.yieldShare.totalSupply()).to.equal(0);
      expect(await pool.yieldShare.name()).to.equal(testPool.yieldName);
      expect(await pool.yieldShare.symbol()).to.equal(testPool.yieldName);
    });
  });
});
