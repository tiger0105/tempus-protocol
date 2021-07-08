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

  async function createAavePool(depositToUser:number = 0) {
    aave = await Aave.create(1000000);
    await aave.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some ATokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await aave.deposit(owner, depositToUser*2);
      await aave.yieldToken.transfer(owner, user, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    pool = await TempusPool.deploy(aave.assetPool, maturityTime);
  }

  async function createCompoundPool(depositToUser:number = 0) {
    compound = await Comptroller.create(1000000);
    await compound.asset.transfer(owner, user, 10000); // initial deposit for User

    // generate some CTokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await compound.enterMarkets(owner);
      await compound.payableDeposit(owner, depositToUser*2);
      await compound.yieldToken.transfer(owner, user, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    pool = await TempusPool.deploy(compound.assetPool, maturityTime);
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
    pool = await TempusPool.deploy(lido.assetPool, maturityTime);
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

    it("Initial exchange rate should be set", async () =>
    {
      await createAavePool();
      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(1.0);
    });
  });

  describe("Deposit AAVE", async () =>
  {
    it("Should allow depositing 100", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should allow depositing 100 again", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(200);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(200);
    });

    it("Depositing after increase", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
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

    it("Should give appropriate shares after ASSET deposit", async () =>
    {
      await createAavePool();
      await pool.depositAsset(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });

  describe("Deposit Lido", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createLidoPool(/*depositToUser:*/500);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should give appropriate shares after ASSET deposit", async () =>
    {
      await createLidoPool();
      await pool.depositAsset(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });

  describe("Deposit Compound", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createCompoundPool(/*depositToUser:*/500);
      await pool.deposit(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should give appropriate shares after ASSET deposit", async () =>
    {
      await createCompoundPool();
      await pool.depositAsset(user, 100);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });
});
