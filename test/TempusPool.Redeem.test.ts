import { expect } from "chai";
import { PoolTestFixture, YBT } from "./pool-utils/PoolTestFixture";
import { describeForEachPool, integrationExclusiveIt as it } from "./pool-utils/MultiPoolTestSuite";
import { expectRevert } from "./utils/Utils";

describeForEachPool("TempusPool Redeem", (pool:PoolTestFixture) =>
{
  it.includeIntegration("Should emit correct event on redemption", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);

    await pool.depositYBT(user, 100);
    await expect(pool.redeemToYBT(user, 100, 100)).to.emit(pool.tempus.controller.contract, 'Redeemed').withArgs(
      pool.tempus.address, // pool
      user.address, // redeemer
      user.address, // recipient
      pool.principals.toBigNum(100), // principal amount
      pool.yields.toBigNum(100), // yield amount
      pool.ybt.toBigNum(100), // yield bearing token amount
      pool.asset.toBigNum(100), // backing token amount
      pool.yields.toBigNum(0), // fee
      pool.tempus.toContractExchangeRate(1.0), // rate
      true // early redeem
    );
  });

  it.includeIntegration("Should revert on redeem with no balance", async () =>
  {
    await pool.createDefault();
    let [owner] = pool.signers;
    (await pool.expectRedeemBT(owner, 1, 1)).to.not.be.equal('success');
  });

  it("Should revert on bad recipient (address 0) with BT", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositYBT(user, 100, /*recipient:*/user);

    (await pool.expectRedeemBT(owner, 100, 100, '0x0000000000000000000000000000000000000000')).to.be.equal('recipient can not be 0x0');
  });

  it("Should revert on bad recipient (address 0) with YBT", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositYBT(user, 100, /*recipient:*/user);

    (await pool.expectRedeemYBT(owner, 100, 100, '0x0000000000000000000000000000000000000000')).to.be.equal('recipient can not be 0x0');
  });

  it("Should revert on random failure from backing pool", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositYBT(user, 100, /*recipient:*/user);

    await pool.forceFailNextDepositOrRedeem();
    (await pool.expectRedeemBT(user, 100, 100)).to.not.equal('success');
  });

  it.includeIntegration("Should redeem exactly equal to deposit if no yield and no fees", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:0, unpegged:0} },
      "deposit 100 with rate 1, should receive 100 TPS+TYS"
    );
    await pool.redeemToYBT(user, 100, 100);
    (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/100, "redeem amount should be equal to original deposit");
  });

  it.includeIntegration("Should fail with insufficient share balances", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 100]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:0, unpegged:0} },
      "deposit 100 with rate 1, should receive 100 TPS+TYS"
    );

    (await pool.expectRedeemYBT(user, 150, 100)).to.equal("Insufficient principals.");
    (await pool.expectRedeemYBT(user, 100, 150)).to.equal("Insufficient yields.");
    // We're checking principal first.
    (await pool.expectRedeemYBT(user, 150, 150)).to.equal("Insufficient principals.");
  });

  it.includeIntegration("Should fail before maturity with unequal shares", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    (await pool.expectRedeemYBT(user, 50, 100)).to.equal("Inequal redemption not allowed before maturity.");
  });

  it.includeIntegration("Should work before maturity with equal shares, without yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );
    await pool.redeemAndCheck(user,
      { amount:{tps:100, tys:100}, balanceAfter:{tps:0, tys:0}, ybtAfter:{pegged:200, unpegged:200} },
      "redeem 100+100 with rate 1 should be 200/200 YBT"
    );
  });

  it.includeIntegration("Should work before maturity with equal shares, with yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setInterestRate(2.0);
    await pool.redeemAndCheck(user,
      { amount:{tps:100, tys:100}, balanceAfter:{tps:0, tys:0}, ybtAfter:{pegged:400, unpegged:200} },
      "redeem 100+100 with rate 2 should be 400/200 YBT"
    );
  });

  it.includeIntegration("Should work before maturity with equal shares, with negative yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setInterestRate(0.9);
    await pool.redeemAndCheck(user, { amount: { tps: 100, tys: 100 }, balanceAfter: { tps: 0, tys: 0 }, ybtAfter: { pegged: 180, unpegged: 200 } });
  });

  it.includeIntegration("Should work before maturity with equal shares, with long period of negative yield", async () =>
  {
    await pool.create({ initialRate:1.0, poolDuration:16*24*60*60, yieldEst:0.1 });
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setTimeDaysAfterPoolStart(1);
    await pool.setInterestRate(0.9);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 90, tys: 90 }, ybtAfter: { pegged: 99, unpegged: 110 } });

    // This is only 6 days in negative yield, so should not trigger a halt.
    await pool.setTimeDaysAfterPoolStart(7);
    await pool.setInterestRate(0.6);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 80, tys: 80 }, ybtAfter: { pegged: 72, unpegged: 120 } });
    expect(await pool.tempus.matured()).to.equal(false);

    // This is the 7th day of negative yield.
    await pool.setTimeDaysAfterPoolStart(8.1);
    // This transaction will trigger the halting, and will work as redemption after maturity.
    // This means redeeming in unequal shares is possible.
    await pool.redeemAndCheck(user, { amount: { tps: 20, tys: 10 }, balanceAfter: { tps: 60, tys: 70 }, ybtAfter: { pegged: 84, unpegged: 140 } });
    // Try the unequal redemption with more TYS too.
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 20 }, balanceAfter: { tps: 50, tys: 50 }, ybtAfter: { pegged: 90, unpegged: 150 } });

    // Check that the pool HAS matured/halted yet.
    expect(await pool.tempus.matured()).to.equal(true);
    // TODO: extract expected timestamp from the helpers above
    expect(await pool.tempus.exceptionalHaltTime()).to.not.equal(null);

    await pool.setTimeDaysAfterPoolStart(14);
    await pool.setInterestRate(0.2);
    await pool.redeemAndCheck(user, { amount: { tps: 25, tys: 25 }, balanceAfter: { tps: 25, tys: 25 }, ybtAfter: { pegged: 35, unpegged: 175 } });

    // Move past the duration and ensure a lower rate is used.
    await pool.setTimeDaysAfterPoolStart(17);
    await pool.setInterestRate(0.1);
    // Redemeem the remainder.
    await pool.redeemAndCheck(user, { amount: { tps: 25, tys: 25 }, balanceAfter: { tps: 0, tys: 0 }, ybtAfter: { pegged: 20, unpegged: 200 } });
  });

  it.includeIntegration("Should work before maturity with equal shares, with fluctuating yield", async () =>
  {
    await pool.create({ initialRate:1.0, poolDuration:16*24*60*60, yieldEst:0.1 });
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setTimeDaysAfterPoolStart(1);
    await pool.setInterestRate(0.9);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 90, tys: 90 }, ybtAfter: { pegged: 99, unpegged: 110 } });

    await pool.setTimeDaysAfterPoolStart(5);
    await pool.setInterestRate(1.1);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 80, tys: 80 }, ybtAfter: { pegged: 132, unpegged: 120 } });

    await pool.setTimeDaysAfterPoolStart(8);
    await pool.setInterestRate(0.6);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 70, tys: 70 }, ybtAfter: { pegged: 78, unpegged: 130 } });

    await pool.setTimeDaysAfterPoolStart(13);
    await pool.setInterestRate(0.2);
    await pool.redeemAndCheck(user, { amount: { tps: 10, tys: 10 }, balanceAfter: { tps: 60, tys: 60 }, ybtAfter: { pegged: 28, unpegged: 140 } });

    await pool.setTimeDaysAfterPoolStart(14);
    await pool.setInterestRate(1);
    await pool.redeemAndCheck(user, { amount: { tps: 60, tys: 60 }, balanceAfter: { tps: 0, tys: 0 }, ybtAfter: { pegged: 200, unpegged: 200 } });

    // Check that the pool HAS NOT matured/halted yet.
    expect(await pool.tempus.matured()).to.equal(false);
    expect(await pool.tempus.exceptionalHaltTime()).to.equal(null);
  });

  it.includeIntegration("Should work after maturity with negative yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setInterestRate(0.9);
    await pool.checkWallet(user,
      {shares:{tps:100,tys:100}, ybt:{pegged:90,unpegged:100}},
      "rate 0.9 should give 90/100 YBT"
    );

    await pool.fastForwardToMaturity();
    await pool.redeemAndCheck(user,
      { amount:{tps:100, tys:100}, balanceAfter:{tps:0, tys:0}, ybtAfter:{pegged:180, unpegged:200} },
      "redeem 100+100 after maturity should give +90/100 YBT"
    );
  });

  it.includeIntegration("Should work after maturity with negative yield between maturity and redemption", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setInterestRate(1.2);
    await pool.fastForwardToMaturity();
    await pool.setInterestRate(1.1);

    await pool.checkWallet(user,
      {shares:{tps:100,tys:100}, ybt:{pegged:110,unpegged:100}},
      "maturity at rate 1.1 should give 110/100 YBT"
    );

    await pool.redeemAndCheck(user,
      { amount:{tps:100, tys:100}, balanceAfter:{tps:0, tys:0}, ybtAfter:{pegged:220, unpegged:200} },
      "redeem 100+100 after maturity should give +110/100 YBT"
    );
  });

  it.includeIntegration("Should work after maturity with unequal shares, without yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.fastForwardToMaturity();
    await pool.redeemAndCheck(user,
      { amount:{tps:50, tys:100}, balanceAfter:{tps:50, tys:0}, ybtAfter:{pegged:150, unpegged:150} },
      "redeem 50+100 with rate 1 after maturity should be 150/150 YBT"
    );
  });

  it.includeIntegration("Should work after maturity with unequal shares, with yield", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );

    await pool.setInterestRate(2.0);
    await pool.checkWallet(user, {shares:{tps:100, tys:100}, ybt:{pegged:200, unpegged:100}},
      "pegged asset should be 200 after rate 2x"
    );

    await pool.fastForwardToMaturity();
    await pool.redeemAndCheck(user,
      { amount:{tps:50, tys:100}, balanceAfter:{tps:50, tys:0}, ybtAfter:{pegged:350, unpegged:175} },
      "redeem 50+100 with rate 2 after maturity should be 350/175 YBT"
    );
  });

  it.includeIntegration("Should work after maturity with additional yield after maturity", async () =>
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 200]]);
    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:100, unpegged:100} },
      "deposit 100 with rate 1 all balances should be 100"
    );
    
    await pool.setInterestRate(2.0);
    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/200);
        await pool.fastForwardToMaturity();
        await pool.setInterestRate(4.0);
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
    
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/600);
        expect(await pool.ybt.balanceOf(pool.tempus.address)).to.equal(200);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
        await pool.fastForwardToMaturity();
        await pool.setInterestRate(4.0);
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/100);
    
        await pool.redeemToYBT(user, 100, 100);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/150);
        expect(await pool.ybt.balanceOf(pool.tempus.address)).to.equal(50);
    }
  });

  it.includeIntegration("Should redeem correct amount of tokens with multiple users depositing", async () =>
  {
    await pool.createDefault();
    let [owner, user, user2] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500], [user2, 500]]);

    await pool.depositAndCheck(user,
      { ybtAmount:100, balanceAfter:{tps:100, tys:100}, ybtAfter:{pegged:400, unpegged:400} },
      "deposit 100 YBT with rate 1, expect shares 100 and YBT 400"
    );

    await pool.setInterestRate(2.0);

    if (pool.yieldPeggedToAsset)
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/800);
        await pool.depositYBT(user, 100, /*recipient:*/user);
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/700);
    
        // Now the second user joins.
        await pool.depositYBT(user2, 200, /*recipient:*/user2);
        (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/800);
    
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.0);
    
        await pool.setInterestRate(2.5);
        await pool.fastForwardToMaturity();
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.5);
        expect(await pool.tempus.maturityInterestRate()).to.equal(2.5);
    
        // First user redeems
        (await pool.userState(user)).expect(150, 150, /*yieldBearing:*/875);
        await pool.redeemToYBT(user, 150, 150);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/1250);
    
        // Second user redeems
        (await pool.userState(user2)).expect(100, 100, /*yieldBearing:*/1000);
        await pool.redeemToYBT(user2, 100, 100);
        (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/1250);
    }
    else
    {
        (await pool.userState(user)).expect(100, 100, /*yieldBearing:*/400);
        await pool.depositYBT(user, 100, /*recipient:*/user);
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
    
        // Now the second user joins.
        await pool.depositYBT(user2, 200, /*recipient:*/user2);
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
    
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.0);
    
        await pool.setInterestRate(2.5);
        await pool.fastForwardToMaturity();
        expect(await pool.tempus.initialInterestRate()).to.equal(1.0);
        expect(await pool.tempus.currentInterestRate()).to.equal(2.5);
        expect(await pool.tempus.maturityInterestRate()).to.equal(2.5);
    
        // First user redeems
        (await pool.userState(user)).expect(200, 200, /*yieldBearing:*/300);
        await pool.redeemToYBT(user, 200, 200);
        (await pool.userState(user)).expect(0, 0, /*yieldBearing:*/500);
    
        // Second user redeems
        (await pool.userState(user2)).expect(200, 200, /*yieldBearing:*/300);
        await pool.redeemToYBT(user2, 200, 200);
        (await pool.userState(user2)).expect(0, 0, /*yieldBearing:*/500);
    }
  });
  it.includeIntegration("Should revert when trying to call redeem directly on TempusPool (not via the TempusController)", async () => 
  {
    await pool.createDefault();
    let [owner, user] = pool.signers;
    await pool.setupAccounts(owner, [[user, 500]]);
    
    (await expectRevert(pool.tempus.redeem(user, 1, 1))).to.equal("Only callable by TempusController");
  });

});
