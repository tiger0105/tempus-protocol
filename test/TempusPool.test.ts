import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
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

  function expectRevert(promise, message = null) {
    return message ?
      expect(promise).to.be.revertedWith(message)
      :
      expect(promise).to.be.reverted;
  }

  async function blockTimestamp() {
    return (await ethers.provider.getBlock('latest')).timestamp;
  }

   async function increaseTime(addSeconds) {
    await ethers.provider.send("evm_increaseTime", [addSeconds]);
    await ethers.provider.send("evm_mine", []);
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
    pool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime);
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
    pool = await TempusPool.deploy(compound.yieldToken, compound.priceOracle, maturityTime);
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
      await expectRevert(pool.finalize(), "Maturity not been reached yet");
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
      await expectRevert(pool.finalize(), "Maturity not been reached yet");
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
      await pool.finalize();
      await pool.finalize();
      await pool.finalize();
      expect(await pool.matured()).to.equal(true);
    });
  });

  describe("Deposit AAVE", async () =>
  {
    it("Should allow depositing 100", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should allow depositing 100 again", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(200);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(200);
    });

    it("Depositing after increase", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);

      await setExchangeRate(2.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(150);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(150);

      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.0);
    });

    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createAavePool();
      const wrapper = await ContractBase.deployContract("AaveDepositWrapper", pool.address());
      await aave.asset.approve(user, wrapper.address, 100);
      await wrapper.connect(user).deposit(aave.toBigNum(100));
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should not allow depositing after finalization", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await increaseTime(60*60);
      await pool.finalize();
      await expectRevert(pool.deposit(user, 100, /*recipient:*/user), "Maturity reached.");
    });
  });

  describe("Redeem AAVE", async () =>
  {
    it("Should fail with insufficient share balances", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);

      await expectRevert(pool.redeem(user, 150, 100), "Insufficient principal balance.");
      await expectRevert(pool.redeem(user, 100, 150), "Insufficient yield balance.");
      // We're checking principal first.
      await expectRevert(pool.redeem(user, 150, 150), "Insufficient principal balance.");
    });

    it("Should fail before maturity with uneqal shares", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);

      await expectRevert(pool.redeem(user, 50, 100), "Inequal redemption not allowed before maturity.");
    });

    it("Should work before maturity with equal shares (unimplemented)", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);

      // TODO: implement the underlying
      await expectRevert(pool.redeem(user, 100, 100), "Unimplemented.");
    });

    it("Should work after maturity with unequal shares (unimplemented)", async () =>
    {
      await createAavePool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
      await increaseTime(60*60);
      await pool.finalize();

      // TODO: implement the underlying
      await expectRevert(pool.redeem(user, 50, 100), "Unimplemented.");
    });
  });

  describe("Deposit Lido", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createLidoPool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should give appropriate shares after ASSET Wrapper deposit", async () =>
    {
      await createLidoPool();
      const wrapper = await ContractBase.deployContract("LidoDepositWrapper", pool.address());
      await wrapper.connect(user).deposit({value: lido.toBigNum(100)});
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });

  describe("Deposit Compound", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createCompoundPool(/*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });
});
