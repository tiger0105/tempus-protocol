import { ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase, Signer } from "./utils/ContractBase";
import { Comptroller } from "./utils/Comptroller";
import { TempusPool } from "./utils/TempusPool";
import { blockTimestamp } from "./utils/Utils";

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
    pool = await TempusPool.deploy(compound.yieldToken, compound.priceOracle, maturityTime);
  }

  describe("Deposit Compound", async () =>
  {
    it("Should give appropriate shares after pool deposit", async () =>
    {
      await createCompoundPool('CErc20', /*depositToUser:*/500);
      await pool.deposit(user, 100, /*recipient:*/user);
      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should give appropriate shares after CEther ASSET Wrapper deposit", async () =>
    {
      await createCompoundPool('CEther');

      const wrapper = await ContractBase.deployContract("CompoundEtherDepositWrapper", pool.address);
      await wrapper.connect(user).depositEther({value: compound.toBigNum(100)});

      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });

    it("Should give appropriate shares after CErc20 ASSET Wrapper deposit", async () =>
    {
      await createCompoundPool('CErc20');

      const wrapper = await ContractBase.deployContract("CompoundErc20DepositWrapper", pool.address);
      await compound.asset.approve(user, wrapper.address, 100);
      await wrapper.connect(user).deposit(compound.asset.toBigNum(100));

      expect(await pool.principalShare.balanceOf(user)).to.equal(100);
      expect(await pool.yieldShare.balanceOf(user)).to.equal(100);
    });
  });
});
