import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Lido } from "./utils/Lido";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool, expectUserState } from "./utils/TempusPool";
import { NumberOrString } from "./utils/Decimal";
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

  async function setExchangeRate(exchangeRate:NumberOrString) {
    if (aave) aave.setLiquidityIndex(exchangeRate);
    else if (compound) compound.setExchangeRate(exchangeRate);
  }

  async function createAavePool(liquidityIndex:number = 1.0, depositToUser:number = 0) {
    aave = await Aave.create(1000000);
    await aave.asset.transfer(owner, user, 10000); // initial deposit for User

    // set starting rate
    await aave.setLiquidityIndex(liquidityIndex);

    // generate some ATokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await aave.deposit(owner, depositToUser*4);
      await aave.yieldToken.transfer(owner, user, depositToUser);
      await aave.yieldToken.transfer(owner, user2, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    pool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime);
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
    pool = await TempusPool.deploy(lido.yieldToken, lido.priceOracle, maturityTime);
  }

  describe("Deploy", async () =>
  {
    it("Version is correct", async () =>
    {
      await createAavePool();
      expect(await pool.version()).to.equal(1);
    });

    it("Start and maturity time", async () =>
    {
      await createAavePool();
      expect(await pool.startTime()).to.lte(await blockTimestamp());
      expect(await pool.maturityTime()).to.equal(maturityTime);
    });

    it("Maturity should not be set", async () =>
    {
      await createAavePool();
      expect(await pool.matured()).to.equal(false);
    });

    it("Exchange rates should be set", async () =>
    {
      await createAavePool();
      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(1.0);
      expect(await pool.maturityExchangeRate()).to.equal(0.0);
    });

    it("Finalize prior to maturity", async () =>
    {
      await createAavePool();
      (await expectRevert(pool.finalize())).to.equal("Maturity not been reached yet.");
    });

    it("Finalize on/after maturity", async () =>
    {
      await createAavePool();
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
    });

    it("Finalizing multiple times", async () =>
    {
      await createAavePool();
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
      await createAavePool();
      expect(await pool.principalShare.totalSupply()).to.equal(0);
      expect(await pool.principalShare.name()).to.equal("TPS-AAT");
      expect(await pool.principalShare.symbol()).to.equal("TPS-AAT");
    });

    it("Yield shares initial details", async () =>
    {
      await createAavePool();
      expect(await pool.yieldShare.totalSupply()).to.equal(0);
      expect(await pool.yieldShare.name()).to.equal("TYS-AAT");
      expect(await pool.yieldShare.symbol()).to.equal("TYS-AAT");
    });
  });

  describe("Deposit AAVE", async () =>
  {
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
      await createAavePool(/*liquidityIndex:*/1.2, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 120, 120, /*yieldBearing:*/400);
    });

    it("Depositing after increase", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setExchangeRate(2.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 200, 200, /*yieldBearing:*/300);

      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.0);
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

    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createAavePool();
      const wrapper = await ContractBase.deployContract("AaveDepositWrapper", pool.address);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);
      await aave.asset.approve(user, wrapper.address, 100);
      await wrapper.connect(user).deposit(aave.toBigNum(100));
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);
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

      await setExchangeRate(2.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 200, 200, /*yieldBearing:*/300);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/300);

      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.0);
    });
  });

  describe("Redeem AAVE", async () =>
  {
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

    it("Should work before maturity with equal shares, without yield (unimplemented)", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      // TODO: implement the underlying
      (await expectRevert(pool.redeem(user, 100, 100))).to.equal("Unimplemented.");
    });

    it("Should work before maturity with equal shares, with yield (unimplemented)", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await setExchangeRate(2.0);

      // TODO: implement the underlying
      (await expectRevert(pool.redeem(user, 100, 100))).to.equal("Unimplemented.");
    });

    it("Should work after maturity with unequal shares, without yield (unimplemented)", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await increaseTime(60*60);
      await pool.finalize();

      // TODO: implement the underlying
      (await expectRevert(pool.redeem(user, 50, 100))).to.equal("Unimplemented.");
    });

    it("Should work after maturity with unequal shares, with yield (unimplemented)", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
      await setExchangeRate(2.0);

      await increaseTime(60*60);
      await pool.finalize();

      // TODO: implement the underlying
      (await expectRevert(pool.redeem(user, 50, 100))).to.equal("Unimplemented.");
    });
  });

  describe("Deposit Lido", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createLidoPool(/*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
    });

    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createLidoPool();
      const wrapper = await ContractBase.deployContract("LidoDepositWrapper", pool.address);
      await wrapper.connect(user).deposit({value: lido.toBigNum(100)});
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);
    });
  });

  describe("Fees", async () =>
  {
    it("Should collect tokens as fees during deposit() if fees != 0", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);

      await pool.setFees(owner, 0.01, 0.0, 0.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100); // all 100 in the pool
      // but user receives 99
      await expectUserState(pool, user, 99, 99, /*yieldBearing:*/400);
    });
  });
});
