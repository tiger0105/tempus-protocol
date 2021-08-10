
import { ethers } from "hardhat";
import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

import { Signer } from "./utils/ContractBase";
import { expectRevert, increaseTime } from "./utils/Utils";

describeForEachPool("TempusPool Deposit", async (pool:ITestPool) =>
{
  let owner:Signer, user:Signer, user2:Signer;

  beforeEach(async () =>
  {
    [owner, user, user2] = await ethers.getSigners();
  });

  it("Should allow depositing 100 (initialRate=1.0)", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);

    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
  });

  it("Should allow depositing 100 again (initialRate=1.0)", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);

    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
  });

  it("Should get different yield tokens when depositing 100 (initialRate=1.2)", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.2);
    await pool.setupAccounts(owner, [[user, 500]]);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);

    await pool.depositYBT(user, 100);
    if (pool.mintScalesWithRate) {
      (await pool.userState(user)).expect(120, 120, /*yieldBearing:*/400);
    } else {
      (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    }
  });

  it("Should revert on negative yield during deposit", async () => 
  {
    await pool.createTempusPool(/*initialRate*/1.1);
    await pool.setupAccounts(owner, [[user, 500]]);
    await pool.setExchangeRate(0.9);

    (await expectRevert(pool.depositYBT(user, 100))).to.equal("Negative yield!");
  });

  it("Should increase YBT 2x after changing rate to 2.0", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 200]]);

    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    // after 2x exchangeRate our YBT will be worth 2x as well:
    await pool.setExchangeRate(2.0);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);

    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/100);

    expect(await pool.tempus.initialExchangeRate()).to.equal(1.0);
    expect(await pool.tempus.currentExchangeRate()).to.equal(2.0);
  });

  it("Should allow depositing with different recipient", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);
    await pool.depositYBT(user, 100, /*recipient:*/user2);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/500);
  });

  it("Should not allow depositing after finalization", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    await increaseTime(60*60);
    await pool.tempus.finalize();
    (await expectRevert(pool.depositYBT(user, 100))).to.equal("Maturity reached.");
  });

  it("Should allow depositing from multiple users", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);
    await pool.depositYBT(user, 100);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);
    await pool.depositYBT(user2, 200);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
  });

  it("Should allow depositing from multiple users with different rates", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    await pool.depositYBT(user, 100, /*recipient:*/user);
    await pool.depositYBT(user2, 200, /*recipient:*/user2);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);

    await pool.setExchangeRate(2.0);

    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/800);
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/600);
    await pool.depositYBT(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/700);
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/600);

    expect(await pool.tempus.initialExchangeRate()).to.equal(1.0);
    expect(await pool.tempus.currentExchangeRate()).to.equal(2.0);
  });

});
