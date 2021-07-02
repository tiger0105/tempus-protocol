import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Lido } from "./utils/Lido";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool } from "./utils/TempusPool";
import { NumberOrString } from "./utils/Decimal";

describe("Tempus Pool", async () => {
  let owner:Signer, user:Signer;
  let aave:Aave;
  let lido:Lido;
  let compound:Comptroller;
  let pool:TempusPool;
  let maturityTime:number;

  async function blockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
  }

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
  });

  async function setExchangeRate(exchangeRate:NumberOrString) {
    if (aave) aave.setLiquidityIndex(exchangeRate);
    else if (compound) compound.setExchangeRate(exchangeRate);
  }

  async function createAavePool() {
    aave = await Aave.create(1000000);
    await aave.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some ATokens by owner depositing, and then transfer some to user
    await aave.deposit(owner, 1000);
    await aave.yieldToken.transfer(owner, user, 500);

    let maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    pool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime);
  }

  async function createCompoundPool() {
    compound = await Comptroller.create(1000000);
    await compound.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some CTokens by owner depositing, and then transfer some to user
    await compound.enterMarkets(owner);
    await compound.payableDeposit(owner, 1000);
    await compound.yieldToken.transfer(owner, user, 500);

    let maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    pool = await TempusPool.deploy(compound.yieldToken, compound.priceOracle, maturityTime);
  }

  async function createLidoPool() {
    lido = await Lido.create(1000000);
    await lido.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some StETH by owner depositing, and then transfer some to user
    await lido.submit(owner, 1000);
    await lido.yieldToken.transfer(owner, user, 500);

    let maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
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
      expect(await pool.startTime()).to.lte(await blockTimestamp());
      expect(await pool.maturityTime()).to.equal(maturityTime);
    });
    it("Initial exchange rate should be set", async () =>
    {
      await createAavePool();
      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(1.0);
    });
  });

  describe("Deposit", async () =>
  {
    it("Should allow depositing 100", async () =>
    {
      await createAavePool();
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should allow depositing 100 again", async () =>
    {
      await createAavePool();
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(200);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(200);
    });

    it("Depositing after AAVE increase", async () =>
    {
      await createAavePool();
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);

      await setExchangeRate(2.0);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(150);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(150);

      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.0);
    });
  });

  describe("Wrapped Lido", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createLidoPool();
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });

  describe("Wrapped Compound", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createCompoundPool();
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });
});
