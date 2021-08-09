
import { ethers } from "hardhat";
import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

import { Signer } from "./utils/ContractBase";
import { TempusPool, expectUserState } from "./utils/TempusPool";
import { expectRevert, blockTimestamp, increaseTime } from "./utils/Utils";
import { fromWei } from "./utils/Decimal";

describeForEachPool("TempusPool Deploy", async (testPool:ITestPool) =>
{
  let owner:Signer, user:Signer, user2:Signer;
  let pool:TempusPool;

  beforeEach(async () =>
  {
    [owner, user, user2] = await ethers.getSigners();
  });

  it("Should allow depositing 100 (initialRate=1.0)", async () =>
  {
    pool = await testPool.createTempusPool(/*initialRate*/1.0);
    await testPool.setupAccounts(owner, [[user, 500]]);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);

    await pool.deposit(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
  });

  it("Should allow depositing 100 again (initialRate=1.0)", async () =>
  {
    pool = await testPool.createTempusPool(/*initialRate*/1.0);
    await testPool.setupAccounts(owner, [[user, 500]]);

    await pool.deposit(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);

    await pool.deposit(user, 100, /*recipient:*/user);
    (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
  });

  it("Should get different yield tokens when depositing 100 (initialRate=1.2)", async () =>
  {
    pool = await testPool.createTempusPool(/*initialRate*/1.2);
    await testPool.setupAccounts(owner, [[user, 500]]);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    
    await pool.deposit(user, 100, /*recipient:*/user);
    if (testPool.mintScalesWithRate) {
      (await pool.userState(user)).expect(120, 120, /*yieldBearing:*/400);
    } else {
      (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    }
  });

  it("Should revert on negative yield during deposit", async () => 
  {
    pool = await testPool.createTempusPool(/*initialRate*/1.1);
    await testPool.setupAccounts(owner, [[user, 500]]);
    await testPool.setExchangeRate(0.9);

    (await expectRevert(pool.deposit(user, 100, /*recipient:*/user))).to.equal("Negative yield!");
  });

//   it("Depositing after increase", async () =>
//   {
//     await testPool.setExchangeRate(1.0);
//     await testPool.deposit(owner, [user], 500);
//     //await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

//     await pool.deposit(user, 100, /*recipient:*/user);
//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

//     await testPool.setExchangeRate(2.0);
//     //await setExchangeRate(2.0);
//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
//     await pool.deposit(user, 100, /*recipient:*/user);
//     await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);

//     expect(await pool.initialExchangeRate()).to.equal(1.0);
//     expect(await pool.currentExchangeRate()).to.equal(2.0);
//   });

//   it("Should allow depositing with different recipient", async () =>
//   {
//     await testPool.setExchangeRate(1.0);
//     await testPool.deposit(owner, [user], 500);
//     //await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

//     await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
//     await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
//     await pool.deposit(user, 100, /*recipient:*/user2);
//     await expectUserState(pool, user, 0, 0, /*yieldBearing:*/400);
//     await expectUserState(pool, user2, 100, 100, /*yieldBearing:*/500);
//   });

//   it("Should not allow depositing after finalization", async () =>
//   {
//     await testPool.setExchangeRate(1.0);
//     await testPool.deposit(owner, [user], 500);
//     //await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);

//     await increaseTime(60*60);
//     await pool.finalize();
//     (await expectRevert(pool.deposit(user, 100, /*recipient:*/user))).to.equal("Maturity reached.");
//   });

//   it("Should allow depositing from multiple users", async () =>
//   {
//     await testPool.setExchangeRate(1.0);
//     await testPool.deposit(owner, [user], 500);
//     //await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

//     await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
//     await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
//     await pool.deposit(user, 100, /*recipient:*/user);
//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
//     await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
//     await pool.deposit(user2, 200, /*recipient:*/user2);
//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
//     await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/300);
//   });

//   it("Should allow depositing from multiple users with different rates", async () =>
//   {
//     await testPool.setExchangeRate(1.0);
//     await testPool.deposit(owner, [user], 500);
//     //await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

//     await pool.deposit(user, 100, /*recipient:*/user);
//     await pool.deposit(user2, 200, /*recipient:*/user2);
//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
//     await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/300);

//     await testPool.setExchangeRate(2.0);
//     //await setExchangeRate(2.0);

//     await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
//     await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);
//     await pool.deposit(user, 100, /*recipient:*/user);
//     await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);
//     await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);

//     expect(await pool.initialExchangeRate()).to.equal(1.0);
//     expect(await pool.currentExchangeRate()).to.equal(2.0);
//   });
});
