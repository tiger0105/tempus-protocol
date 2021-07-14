import { ethers } from "hardhat";
import { expect } from "chai";
import { Yearn } from "../../utils/Yearn";
import { Signer } from "../../utils/ContractBase";

describe("Yearn Mock", async () => {
  let owner:Signer, user:Signer;
  let pool: Yearn;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    pool = await Yearn.create(1000000);
    await pool.asset.transfer(owner, user, 10); // give user 10 asset coins
  });

  describe("Deposit", async () =>
  {
    it("Should have 1ray rate at initial deposit", async () =>
    {
      expect(await pool.pricePerShare()).to.equal(1.0);
      await pool.deposit(user, 4);
      
      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(4);
    });

    it("Should receive 0.5x yield tokens if rate is 2.0", async () =>
    {
      expect(await pool.pricePerShare()).to.equal(1.0);
      await pool.deposit(owner, 4); // initial deposit from owner to allow using increasePricePerShare
      await pool.increasePricePerShare(2.0);
      expect(await pool.pricePerShare()).to.equal(2.0);

      await pool.deposit(user, 4);
      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(2);
    });
  });
});
