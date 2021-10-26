import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

import { Signer } from "./utils/ContractBase";
import { PoolType } from "./utils/TempusPool";
import { expectRevert } from "./utils/Utils";

// Aave getReserveNormalizedIncome() = 0, would mean aToken balance is always 0, so it's not recoverable
// Lido getPooledEthByShares(1) = 0, would mean totalShares == 0, or totalPooledEth is 0, so it's not recoverable
describeForEachPool.type("TempusPool Recovery", [PoolType.Compound], (pool:ITestPool) =>
{
  let owner:Signer, user:Signer, user2:Signer;

  beforeEach(async () =>
  {
    await pool.createDefault();
    [owner, user, user2] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]); // give user 500 YBT
  });

  it.only("Should allow recovering YBT if exchangeRate is 0", async () =>
  {
    await pool.depositYBT(user, 500); // deposit ALL
    expect(await pool.yieldTokenBalance(user2)).to.equal(0, 'user2 balance must be 0');
    const TVL = await pool.yieldTokenBalance(pool.tempus.address);
    expect(TVL).to.equal(500, 'TempusPool TVL should be equal to deposited YBT amount');

    (await expectRevert(pool.tempus.governanceRecoverYBT(user, user))).to.equal('Caller is not the owner');
    (await expectRevert(pool.tempus.governanceRecoverYBT(owner, user2))).to.equal('rate must be 0');

    await pool.setInterestRate(0.0);
    await pool.tempus.governanceRecoverYBT(owner, user2);
    expect(await pool.tempus.yieldBearing.balanceOf(user2)).to.equal(TVL);
  });

  it.only("Should not allow recovering YBT if TVL is 0", async () =>
  {
    expect(await pool.yieldTokenBalance(pool.tempus.address)).to.equal(0, 'TVL must be 0');
    await pool.setInterestRate(0.0);
    (await expectRevert(pool.tempus.governanceRecoverYBT(owner, user2))).to.equal('total locked YBT is 0');
  });
});
