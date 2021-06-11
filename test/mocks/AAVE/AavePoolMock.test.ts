import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

describe("AAVE Mock", async () => {
  let pool;
  let owner, user;
  let asset;
  const _1ray   = "1000000000000000000000000000";
  const twoRay  = "2000000000000000000000000000";
  const halfRay =  "500000000000000000000000000";

  async function transfer(from, to, amount) {
    await asset.connect(from).transfer(to.address, amount);
  }

  async function assetBalance(signer) {
    return expect(await asset.balanceOf(signer.address));
  }

  async function yieldBalance(signer) {
    return expect(await pool.getDeposit(signer.address));
  }

  async function getLiquidityIndex() {
    return expect(await pool.getReserveNormalizedIncome(asset.address));
  }

  async function deposit(signer, amount) {
    await asset.connect(signer).approve(pool.address, amount);
    await pool.connect(signer).deposit(asset.address, amount, signer.address, 0/*referral*/);
  }

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    let BackingToken = await ethers.getContractFactory("ERC20FixedSupply");
    asset = await BackingToken.deploy("DAI Stablecoin", "DAI", 1000000);

    let AavePoolMock = await ethers.getContractFactory("AavePoolMock");
    pool = await AavePoolMock.deploy(
      asset.address
    );

    await transfer(owner, user, 10);
  });

  describe("Deposit", async () =>
  {
    it("Should have 1ray rate at initial deposit", async () =>
    {
      (await getLiquidityIndex()).to.equal(_1ray);
      await deposit(user, 4);
      
      (await assetBalance(user)).to.equal(6);
      (await yieldBalance(user)).to.equal(4);
    });

    it("Should receive 0.5x yield tokens if rate is 2.0", async () =>
    {
      await pool.setLiquidityIndex(twoRay);
      (await getLiquidityIndex()).to.equal(twoRay);

      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await deposit(user, 4);
      (await assetBalance(user)).to.equal(6);
      (await yieldBalance(user)).to.equal(2);
    });

    it("Should receive 2.0x yield tokens if rate is 0.5", async () =>
    {
      await pool.setLiquidityIndex(halfRay);
      (await getLiquidityIndex()).to.equal(halfRay);

      // with 0.5 rate, user deposits 4 asset tokens and receives 8 yield tokens
      await deposit(user, 4);
      (await assetBalance(user)).to.equal(6);
      (await yieldBalance(user)).to.equal(8);
    });

    it("Should receive different amount of yield tokens if rate changes", async () =>
    {
      // with 1.0 rate, user deposits 4 assets and receives 4 yield tokens
      await deposit(user, 4);
      (await yieldBalance(user)).to.equal(4);
      
      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await pool.setLiquidityIndex(twoRay);
      await deposit(user, 4);
      (await yieldBalance(user)).to.equal(6);
    });
  });
});
