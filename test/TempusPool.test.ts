import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Lido } from "./utils/Lido";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool, expectUserState } from "./utils/TempusPool";
import { MAX_UINT256, NumberOrString } from "./utils/Decimal";
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
    // initial deposit for users
    await aave.asset.transfer(owner, user, 10000);
    await aave.asset.transfer(owner, user2, 10000);

    // set starting rate
    await aave.setLiquidityIndex(liquidityIndex);

    // generate some ATokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await aave.deposit(owner, depositToUser*2);
      await aave.deposit(user, depositToUser);
      await aave.deposit(user2, depositToUser);
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
      await createAavePool(/*liquidityIndex:*/1.2, /*depositToUser:*/520);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/520);
      await pool.deposit(user, 120, /*recipient:*/user);
      await expectUserState(pool, user, 120, 120, /*yieldBearing:*/400);
    });

    it("Depositing after increase", async () =>
    {
      await createAavePool(/*liquidityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await setExchangeRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);

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
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);
      await expectUserState(pool, user2, 200, 200, /*yieldBearing:*/600);

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
      await setExchangeRate(2.0);

      await pool.redeem(user, 100, 100);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/1000);
    });

    it("Should fail after maturity with negative yield", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await aave.setLiquidityIndex(0.9);
      await increaseTime(60*60);
      await pool.finalize();

      (await expectRevert(pool.redeem(user, 50, 100))).to.equal("Negative yield!");
    });

    it("Should fail after maturity with negative yield between maturity and redemption", async () =>
    {
      await createAavePool(/*liqudityIndex:*/1.0, /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);

      await aave.setLiquidityIndex(1.2);
      await increaseTime(60*60);
      await pool.finalize();
      await aave.setLiquidityIndex(1.1);

      (await expectRevert(pool.redeem(user, 50, 100))).to.equal("Negative yield after maturity!");
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
      await setExchangeRate(2.0);
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
      await setExchangeRate(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);

      await increaseTime(60*60);
      await pool.finalize();
      await setExchangeRate(4.0);
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

      await aave.setLiquidityIndex(2.0);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/800);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 150, 150, /*yieldBearing:*/700);

      // Now the second user joins.
      await pool.deposit(user2, 200, /*recipient:*/user2);
      await expectUserState(pool, user2, 100, 100, /*yieldBearing:*/800);

      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.0);

      await aave.setLiquidityIndex(2.5);
      await increaseTime(60*60);
      await pool.finalize();
      expect(await pool.initialExchangeRate()).to.equal(1.0);
      expect(await pool.currentExchangeRate()).to.equal(2.5);
      expect(await pool.maturityExchangeRate()).to.equal(2.5);

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

      await pool.setFeesConfig(owner, 0.01, 0.0, 0.0);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.contractBalance()).to.equal(100); // all 100 in the pool
      // but user receives 99
      await expectUserState(pool, user, 99, 99, /*yieldBearing:*/400);
      expect(await pool.totalFees()).to.equal(1); // and 1 as accumulated fees
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
