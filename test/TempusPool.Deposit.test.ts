
import { ethers } from "hardhat";
import { expect } from "chai";
import { ITestPool, PoolType } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

import { Signer } from "./utils/ContractBase";
import { increaseTime } from "./utils/Utils";

describeForEachPool("TempusPool Deposit", (pool:ITestPool) =>
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

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
  });

  it("Should allow depositing 100 again (initialRate=1.0)", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
  });

  it("Should get different yield tokens when depositing 100 (initialRate=1.25)", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.25);
    await pool.setupAccounts(owner, [[user, 100]]);
    switch (pool.type)
    {
      case PoolType.Aave:
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/100);
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/0);
        break;
      case PoolType.Lido:
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/125);
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(80, 80, /*yieldBearing:*/0);
        break;
      case PoolType.Compound:
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/100);
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(125, 125, /*yieldBearing:*/0);
        break;
    }
  });

  it("Should revert on negative yield during deposit", async () => 
  {
    await pool.createTempusPool(/*initialRate*/1.1);
    await pool.setupAccounts(owner, [[user, 500]]);
    await pool.setExchangeRate(0.9);

    (await pool.expectDepositYBT(user, 100)).to.equal('Negative yield!');
  });

  it("Should increase YBT 2x after changing rate to 2.0", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 200]]);

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);

    await pool.setExchangeRate(2.0);
    switch (pool.type)
    {
      case PoolType.Aave:
        // after 2x exchangeRate our YBT will be worth 2x as well:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/100);
        break;
      case PoolType.Lido:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        (await pool.expectDepositYBT(user, 40)).to.equal('success'); // TODO: this looks wrong, our actual YBT reduced
        (await pool.userState(user)).expect(110, 110, /*yieldBearing:*/20); // TODO: WTF????
        break;
      case PoolType.Compound:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/0);
        break;
    }

    expect(await pool.tempus.initialExchangeRate()).to.equal(1.0);
    expect(await pool.tempus.currentExchangeRate()).to.equal(2.0);
  });

  it("Should allow depositing with different recipient", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 100]]);

    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/100);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/0);

    (await pool.expectDepositYBT(user, 100, user2)).to.equal('success');
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/0);
    (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/0);
  });

  it("Should not allow depositing after finalization", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500]]);

    await increaseTime(60*60);
    await pool.tempus.finalize();
    (await pool.expectDepositYBT(user, 100)).to.equal('Maturity reached.');
  });

  it("Should allow depositing from multiple users", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500],[user2, 500]]);

    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);

    (await pool.expectDepositYBT(user2, 200)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
  });

  it("Should allow depositing from multiple users with different rates", async () =>
  {
    await pool.createTempusPool(/*initialRate*/1.0);
    await pool.setupAccounts(owner, [[user, 500],[user2, 500]]);

    (await pool.expectDepositYBT(user, 100)).to.equal('success');
    (await pool.expectDepositYBT(user2, 200)).to.equal('success');
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400, "user1 YBT reduce by 100");
    (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300, "user2 YBT reduce by 200");

    await pool.setExchangeRate(2.0);

    switch (pool.type)
    {
      case PoolType.Aave:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/800, "user1 YBT increase 2x after rate 2x");
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/600, "user2 YBT increase 2x after rate 2x");
        
        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/700);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/600, "expected NO CHANGE for user2");
        break;
      case PoolType.Lido:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);

        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(125, 125, /*yieldBearing:*/200);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300, "expected NO CHANGE for user2");
        break;
      case PoolType.Compound:
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);

        (await pool.expectDepositYBT(user, 100)).to.equal('success');
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300, "expected NO CHANGE for user2");
        break;
    }

    expect(await pool.tempus.initialExchangeRate()).to.equal(1.0);
    expect(await pool.tempus.currentExchangeRate()).to.equal(2.0);
  });

});
