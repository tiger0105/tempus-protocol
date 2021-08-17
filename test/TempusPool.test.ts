import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Lido } from "./utils/Lido";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool, expectUserState, generateTempusSharesNames } from "./utils/TempusPool";
import { MAX_UINT256, NumberOrString, toWei } from "./utils/Decimal";
import { expectRevert, blockTimestamp, increaseTime } from "./utils/Utils";

describe("Tempus Pool", async () => {
  let owner:Signer, user:Signer, user2:Signer;
  let aave:Aave;
  let lido:Lido;
  let compound:Comptroller;
  let pool:TempusPool;
  let maturityTime:number;

  beforeEach(async () => {
    [owner, user, user2] = await ethers.getSigners();
  });

  async function setInterestRate(exchangeRate:NumberOrString) {
    if (aave) await aave.setLiquidityIndex(exchangeRate, owner);
    else if (compound) await compound.setExchangeRate(exchangeRate);
  }

  async function createAavePool(liquidityIndex:number = 1.0, depositToUser:number = 0) {
    aave = await Aave.create(1000000);
    // initial deposit for users
    await aave.asset.transfer(owner, user, 10000);
    await aave.asset.transfer(owner, user2, 10000);

    // set starting rate
    await setInterestRate(liquidityIndex);

    // generate some ATokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await aave.deposit(owner, depositToUser*2);
      await aave.deposit(user, depositToUser);
      await aave.deposit(user2, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    const names = generateTempusSharesNames("aToken", "aTKN", maturityTime);
    pool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime, names);
  }

  async function createLidoPool(depositToUser:number = 0) {
    lido = await Lido.create(1000000);
    await lido.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some StETH by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await lido.submit(owner, depositToUser*2);
      await lido.yieldToken.transfer(owner, user, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    const names = generateTempusSharesNames("Lido staked token", "stTKN", maturityTime);
    pool = await TempusPool.deploy(lido.yieldToken, lido.priceOracle, maturityTime, names);
  }

  describe("Deposit AAVE", async () =>
  {
    it("Should emit correct event on deposit", async () => {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await expect(pool.deposit(user, 100, user)).to.emit(pool.contract, 'Deposited').withArgs(
        user.address,
        user.address,
        toWei(100),
        toWei(100),
        toWei(1.0)
      );
    });

    it("Should allow depositing 100 (starting rate 1.0)", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
    });

    it("Should allow depositing 100 again", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 200, 200, /*yieldBearing:*/300);
    });

    it("Should allow depositing 100 (starting rate !=1.0)", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.2, /*depositToUser:*/520);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/520);
      await pool.deposit(user, 120, /*recipient:*/user);
      await expectUserState(pool, user, 120, 120, /*yieldBearing:*/400);
    });

    it("Should revert on negative yield during deposit", async () => 
    {
      await createAavePool(1.1, 500);
      setInterestRate(1.0);
      (await expectRevert(pool.deposit(user, 100, /*recipient:*/user))).to.equal("Negative yield!");
    });

    it("Depositing after increase", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setInterestRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);

      expect(await pool.initialInterestRate()).to.equal(1.0);
      expect(await pool.currentInterestRate()).to.equal(2.0);
    });

    it("Should allow depositing with different recipient", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user2);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/400);
      await expectUserState(pool, user2, 100, 100, /*yieldBearing:*/500);
    });

    it("Should not allow depositing after finalization", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await increaseTime(60*60);
      await pool.finalize();
      (await expectRevert(pool.deposit(user, 100, /*recipient:*/user))).to.equal("Maturity reached.");
    });

    it("Should allow depositing from multiple users", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user2, 200, /*recipient:*/user2);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/300);
    });

    it("Should allow depositing from multiple users with different rates", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await pool.deposit(user2, 200, /*recipient:*/user2);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/300);

      await setInterestRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);

      expect(await pool.initialInterestRate()).to.equal(1.0);
      expect(await pool.currentInterestRate()).to.equal(2.0);
    });
  });

  describe("Redeem AAVE", async () =>
  {
    it("Should emit correct event on redemption", async () => {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, user);
      
      await expect(pool.redeem(user, 100, 100)).to.emit(pool.contract, 'Redeemed').withArgs(
        user.address, // redeemer
        toWei(100), // principal amount
        toWei(100), // yield amount
        toWei(100), // yield bearing token amount
        toWei(1.0)  // rate
      );
    });
    it("Should fail with insufficient share balances", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      (await expectRevert(pool.redeem(user, 150, 100))).to.equal("Insufficient principal balance.");
      (await expectRevert(pool.redeem(user, 100, 150))).to.equal("Insufficient yield balance.");
      // We're checking principal first.
      (await expectRevert(pool.redeem(user, 150, 150))).to.equal("Insufficient principal balance.");
    });

    it("Should fail before maturity with uneqal shares", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      (await expectRevert(pool.redeem(user, 50, 100))).to.equal("Inequal redemption not allowed before maturity.");
    });

    it("Should work before maturity with equal shares, without yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
    });

    it("Should work before maturity with equal shares, with yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await setInterestRate(2.0);

      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/1000);
    });

    it("Should work after maturity with negative yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setInterestRate(0.9);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/360);
      await increaseTime(60*60);
      await pool.finalize();

      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/450);
    });

    it("Should work after maturity with negative yield between maturity and redemption", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setInterestRate(1.2);
      await increaseTime(60*60);
      await pool.finalize();
      await setInterestRate(1.1);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/440);

      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/550);
    });

    it("Should work after maturity with unequal shares, without yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await increaseTime(60*60);
      await pool.finalize();

      await pool.redeem(user, 50, 100);
      await expectUserState(pool, user, 50, 0, /*yieldBearing:*/450);
    });

    it("Should work after maturity with unequal shares, with yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await setInterestRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);

      await increaseTime(60*60);
      await pool.finalize();

      await pool.redeem(user, 50, 100);
      await expectUserState(pool, user, 50, 0, /*yieldBearing:*/950);
    });

    it("Should work after maturity with additional yield after maturity", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await setInterestRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);

      await increaseTime(60*60);
      await pool.finalize();
      await setInterestRate(4.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/1600);
      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/1800);
      expect(await aave.yieldBalance(pool.address)).to.equal(200);
    });

    it("Should redeem correct amount of tokens with multiple users depositing", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setInterestRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);

      // Now the second user joins.
      await pool.deposit(user2, 200, /*recipient:*/user2);
      await expectUserState(pool, user2, 100, 100, /*yieldBearing:*/800);

      expect(await pool.initialInterestRate()).to.equal(1.0);
      expect(await pool.currentInterestRate()).to.equal(2.0);

      await setInterestRate(2.5);
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.initialInterestRate()).to.equal(1.0);
      expect(await pool.currentInterestRate()).to.equal(2.5);
      expect(await pool.maturityInterestRate()).to.equal(2.5);

      // First user redeems
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/875);
      await pool.redeem(user, 150, 150);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/ 1250);

      // Second user redeems
      await expectUserState(pool, user2, 100, 100, /*yieldBearing:*/1000);
      await pool.redeem(user2, 100, 100);
      await expectUserState(pool, user2, 0, 0, /*yieldBearing:*/1250);
    });
  });

  describe("DepositWrapper AAVE", () =>
  {
    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/0);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);

      const wrapper = await ContractBase.deployContract("AaveDepositWrapper", pool.address);
      let wrapperC = wrapper.connect(user);
      let initialBalance = await aave.asset.balanceOf(user);
      await aave.asset.approve(user, wrapper.address, 100);
      await wrapperC.deposit(aave.toBigNum(100));
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);

      // withdraw
      await pool.principalShare.approve(user, wrapper.address, 100);
      await pool.yieldShare.approve(user, wrapper.address, 100);
      await wrapperC.redeem(aave.toBigNum(100), aave.toBigNum(100));
      expect(await aave.asset.balanceOf(user)).to.equal(initialBalance);
    });

    it("Should redeem correct amount of ASSET with Yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/0);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);

      const wrapper = await ContractBase.deployContract("AaveDepositWrapper", pool.address);
      let wrapperC = wrapper.connect(user);
      let initialBalance = await aave.asset.balanceOf(user);
      await aave.asset.approve(user, wrapper.address, 100);
      await wrapperC.deposit(aave.toBigNum(100));
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);

      // withdraw with additional yield
      await setInterestRate(1.5);
      await pool.principalShare.approve(user, wrapper.address, 100);
      await pool.yieldShare.approve(user, wrapper.address, 100);
      await wrapperC.redeem(aave.toBigNum(100), aave.toBigNum(100));
      expect(await aave.asset.balanceOf(user)).to.equal(Number(initialBalance) + 50);
    });
  });

  describe("Deposit ASSET Lido", async () =>
  {
    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createLidoPool();
      const wrapper = await ContractBase.deployContract("LidoDepositWrapper", pool.address);
      await wrapper.connect(user).deposit({value: lido.toBigNum(100)});
      // TODO: This test is bugged because expectUserState is deprecated and gives wrong
      //       result for Lido. Disabled until new TempusPool.Deploy.test is finished
      //await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);
    });
  });

  describe("Fees", async () =>
  {
    it("Should collect tokens as fees during deposit() if fees != 0", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

      await pool.setFeesConfig(owner, 0.01, 0.0, 0.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100); // all 100 in the pool
      // but user receives 99
      await expectUserState(pool, user, 99, 99, /*yieldBearing:*/400);
      expect(await pool.totalFees()).to.equal(1); // and 1 as accumulated fees
    });

    it("Should collect tokens as fees during EARLY redeem() if fees != 0", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

      await pool.setFeesConfig(owner, 0.0, 0.01, 0.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100); // all 100 in the pool
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await pool.redeem(user, 100, 100);
      expect(await pool.totalFees()).to.equal(1); // and 1 as accumulated fees
      expect(await pool.contractBalance()).to.equal(1); // should have 1 in the pool (this is the fees)
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/499); // receive 99 back
    });

    it("Should collect tokens as fees during MATURE redeem() if fees != 0", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

      await pool.setFeesConfig(owner, 0.0, 0.0, 0.02);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100); // all 100 in the pool
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      // finalize the pool
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);

      await pool.redeem(user, 100, 100);
      expect(await pool.totalFees()).to.equal(2); // 2 as accumulated fees
      expect(await pool.contractBalance()).to.equal(2); // should have 2 in the pool (this is the fees)
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/498); // receive 98 back
    });

    it("Should transfer fees to specified account", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);

      await pool.setFeesConfig(owner, 0.10, 0.0, 0.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100);

      await expectUserState(pool, user, 90, 90, /*yieldBearing:*/400);
      expect(await pool.totalFees()).to.equal(10);

      await pool.transferFees(owner, user2, 5);
      expect(await pool.yieldBearing.balanceOf(user2)).to.equal(500 + 5);
      expect(await pool.totalFees()).to.equal(5);

      await pool.transferFees(owner, user2, MAX_UINT256);
      expect(await pool.yieldBearing.balanceOf(user2)).to.equal(500 + 10);
      expect(await pool.totalFees()).to.equal(0);
    });
  });
});
