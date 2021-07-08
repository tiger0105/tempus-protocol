import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Lido } from "./utils/Lido";
import { Comptroller } from "./utils/Comptroller";

describe("Asset Pools", async () => {
  let owner:Signer, user:Signer;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
  });

  describe("ExchangeRate", async () =>
  {
    it("Should give correct exchange rate from Aave", async () =>
    {
      let aave:Aave = await Aave.create(1000000);
      let exchangeRate = await aave.assetPool.currentRate();
      expect(exchangeRate).to.equal(1.0);
    });

    it("Should give correct exchange rate from Lido", async () =>
    {
      let lido:Lido = await Lido.create(1000000);
      let exchangeRate = await lido.assetPool.currentRate();
      expect(exchangeRate).to.equal(1.0);
    });
    
    it("Should give correct exchange rate from Compound", async () =>
    {
      let compound:Comptroller = await Comptroller.create(1000000);
      let exchangeRate = await compound.assetPool.currentRate();
      expect(exchangeRate).to.equal(1.0);
    });
  });
});
