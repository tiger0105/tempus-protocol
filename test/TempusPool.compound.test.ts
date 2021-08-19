import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool, expectUserState, generateTempusSharesNames } from "./utils/TempusPool";
import { blockTimestamp } from "./utils/Utils";
import { toWei } from "./utils/Decimal";

describe("Tempus Pool (Compound)", async () => {
  let owner:Signer, user:Signer;
  let compound:Comptroller;
  let pool:TempusPool;
  let maturityTime:number;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
  });

  async function createCompoundPool(type:string, depositToUser:number = 0) {
    compound = await Comptroller.create(type, 1000000);
    if (compound.asset != null) {
      await compound.asset.transfer(owner, user, 10000); // initial deposit for User
    }

    // generate some CTokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await compound.enterMarkets(owner);
      await compound.mint(owner, depositToUser*2);
      await compound.yieldToken.transfer(owner, user, depositToUser);
    }

    maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    const names = generateTempusSharesNames("cToken", "cTKN", maturityTime);
    pool = await TempusPool.deployCompound(compound.yieldToken, compound.priceOracle, maturityTime, names);
  }

  describe("Deposit Compound", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createCompoundPool('CErc20', /*depositToUser:*/500);
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/400);
    });

    it("Should give appropriate shares after CErc20 ASSET Wrapper deposit", async () =>
    {
      await createCompoundPool('CErc20');

      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);
      await compound.asset.approve(user, pool.address, 100);
      await pool.depositBackingToken(user, 100, user);
      
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);
    });
  });

  describe("Deposit Backing Tokens Compound", () =>
  {
    it("Should give appropriate shares after Backing Tokens deposit", async () =>
    {
      await createCompoundPool('CErc20');
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);

      const initialBalance = await compound.asset.balanceOf(user);
      await compound.asset.approve(user, pool.address, 100);
      await pool.depositBackingToken(user, 100, user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);

      // withdraw
      await pool.principalShare.approve(user, pool.address, 100);
      await pool.yieldShare.approve(user, pool.address, 100);
      await pool.redeemToBackingToken(user, 100, 100);
      expect(await compound.asset.balanceOf(user)).to.equal(initialBalance);
    });

    it("Should redeem correct amount of Backing Tokens with Yield", async () =>
    {
      await createCompoundPool('CErc20');
      await expectUserState(pool, user, 0, 0, /*yieldBearing:*/0);

      const initialBalance = await compound.asset.balanceOf(user);
      await compound.asset.approve(user, pool.address, 100);
      await pool.depositBackingToken(user, 100, user);
      await expectUserState(pool, user, 100, 100, /*yieldBearing:*/0);

      // withdraw with additional yield
      await compound.setExchangeRate(1.5, owner);
      await pool.principalShare.approve(user, pool.address, 100);
      await pool.yieldShare.approve(user, pool.address, 100);
      await pool.redeemToBackingToken(user, 100, 100);
      expect(await compound.asset.balanceOf(user)).to.equal(Number(initialBalance) + 50);
    });
  });
});
