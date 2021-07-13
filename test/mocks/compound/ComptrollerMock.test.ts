import { ethers } from "hardhat";
import { expect } from "chai";
import { Comptroller } from "../../utils/Comptroller";
import { Signer } from "../../utils/ContractBase";
import { NumberOrString } from "../../utils/Decimal";
import { revert } from "../../utils/ERC20";

describe("Compound Mock", async () => {
  let owner:Signer, user:Signer;
  let pool:Comptroller;

  describe("Compound CErc20", async () =>
  {
    beforeEach(async () => {
      [owner, user] = await ethers.getSigners();
      pool = await Comptroller.create('CErc20', 1000000); // cDAI
      await pool.asset.transfer(owner, user, 10); // give user 10 asset coins
    });

    it("Should have 1.0 rate at initial deposit", async () =>
    {
      expect(await pool.exchangeRate()).to.equal(1.0);
      expect(await pool.isParticipant(user)).to.be.false;

      await pool.enterMarkets(user);
      expect(await pool.isParticipant(user)).to.be.true;
      await pool.mintERC20(user, 4);
      
      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(4);
    });

    it("Should receive 0.5x yield tokens if rate is 2.0", async () =>
    {
      await pool.setExchangeRate(2.0);
      expect(await pool.exchangeRate()).to.equal(2.0);

      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await pool.enterMarkets(user);
      await pool.mintERC20(user, 4);

      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(2);
    });

    it("Should receive 2.0x yield tokens if rate is 0.5", async () =>
    {
      await pool.setExchangeRate(0.5);
      expect(await pool.exchangeRate()).to.equal(0.5);

      // with 0.5 rate, user deposits 4 asset tokens and receives 8 yield tokens
      await pool.enterMarkets(user);
      await pool.mintERC20(user, 4);

      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(8);
    });

    it("Should receive different amount of yield tokens if rate changes", async () =>
    {
      // with 1.0 rate, user deposits 4 assets and receives 4 yield tokens
      await pool.enterMarkets(user);
      await pool.mintERC20(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(4);
      
      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await pool.setExchangeRate(2.0);
      await pool.mintERC20(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(6);
    });
    
    it("Should be non-participant after exitMarket was called", async () =>
    {
        await pool.enterMarkets(user);
        expect(await pool.isParticipant(user)).to.be.true;
        await pool.exitMarket(user);
        expect(await pool.isParticipant(user)).to.be.false;
    });
  });

  describe("Compound CEther", async () =>
  {
    let userBalance:number;
    beforeEach(async () => {
      [owner, user] = await ethers.getSigners();
      pool = await Comptroller.create('CEther');
      userBalance = Number(await pool.assetBalance(user)).valueOf();
    });

    // when we deposit Ether, the transaction fees reduce our balance
    // so we apply very loose equality check with this utility
    async function almostEqual(actual:Promise<NumberOrString>, expected:number) {
      const actualValue = Math.round(Number(await actual).valueOf());
      const expectedValue = Math.round(expected);
      expect(actualValue).to.equal(expectedValue);
    }

    it("Should have 1.0 rate at initial deposit", async () =>
    {
      expect(await pool.exchangeRate()).to.equal(1.0);
      expect(await pool.isParticipant(user)).to.be.false;

      await pool.enterMarkets(user);
      expect(await pool.isParticipant(user)).to.be.true;
      await pool.mintEther(user, 4);
      
      almostEqual(pool.assetBalance(user), userBalance - 4);
      expect(await pool.yieldBalance(user)).to.equal(4);
    });

    it("Should receive 0.5x yield tokens if rate is 2.0", async () =>
    {
      await pool.setExchangeRate(2.0);
      expect(await pool.exchangeRate()).to.equal(2.0);

      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await pool.enterMarkets(user);
      await pool.mintEther(user, 4);

      almostEqual(pool.assetBalance(user), userBalance - 4);
      expect(await pool.yieldBalance(user)).to.equal(2);
    });

    it("Should receive 2.0x yield tokens if rate is 0.5", async () =>
    {
      await pool.setExchangeRate(0.5);
      expect(await pool.exchangeRate()).to.equal(0.5);

      // with 0.5 rate, user deposits 4 asset tokens and receives 8 yield tokens
      await pool.enterMarkets(user);
      await pool.mintEther(user, 4);

      almostEqual(pool.assetBalance(user), userBalance - 4);
      expect(await pool.yieldBalance(user)).to.equal(8);
    });

    it("Should receive different amount of yield tokens if rate changes", async () =>
    {
      // with 1.0 rate, user deposits 4 assets and receives 4 yield tokens
      await pool.enterMarkets(user);
      await pool.mintEther(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(4);
      
      // with 2.0 rate, user deposits 4 asset tokens and receives 2 yield tokens
      await pool.setExchangeRate(2.0);
      await pool.mintEther(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(6);
    });
    
    it("Should be non-participant after exitMarket was called", async () =>
    {
      await pool.enterMarkets(user);
      await pool.enterMarkets(user); // call it twice for extra branch coverage
      expect(await pool.isParticipant(user)).to.be.true;
      expect(await pool.mintAllowed(user, 10)).to.be.true;
      await pool.exitMarket(user);
      expect(await pool.isParticipant(user)).to.be.false;
      expect(await pool.mintAllowed(user, 10)).to.be.false;
    });
    
    it("Should fail to mint if user is non-participant", async () =>
    {
      (await revert(pool.mintEther(user, 10))).to.be.equal("mint is not allowed");
    });
  });
});
