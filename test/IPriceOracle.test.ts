import { ethers } from "hardhat";
import { expect } from "chai";
import { toWei } from "./utils/Decimal";
import { ContractBase, Signer } from "./utils/ContractBase";
import { IPriceOracle } from "./utils/IPriceOracle";
import { ERC20 } from "./utils/ERC20";
import { Comptroller } from "./utils/Comptroller";
import { Lido } from "./utils/Lido";

describe("Tempus Pool", async () => {
  let owner:Signer, user:Signer;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
  });

  describe("Price Oracle", async () =>
  {
    it("Should give correct exchange rate from Aave", async () =>
    {
      // TODO: use new deployment utilities (will come in another PR)
      const backingAsset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(1000000));
      const aavePool = await ContractBase.deployContract("AavePoolMock", backingAsset.address);
      const yieldToken = await ERC20.attach("ATokenMock", await aavePool.yieldToken());

      let oracle:IPriceOracle = await IPriceOracle.deploy("AavePriceOracle");
      let exchangeRate = await oracle.currentRate(yieldToken);
      let scaledBalance = await oracle.scaledBalance(yieldToken, 2);
      let numYieldTokens = await oracle.numYieldTokensPerAsset(yieldToken, 3);
      expect(exchangeRate).to.equal(1.0);
      expect(scaledBalance).to.equal(2);
      expect(numYieldTokens).to.equal(3);
    });

    it("Should give correct exchange rate from Lido", async () =>
    {
      const lido = await Lido.create(1000000);
      await lido.submit(user, 2);
      const yieldToken = lido.yieldToken;
      let exchangeRate = await lido.priceOracle.currentRate(yieldToken);
      let scaledBalance = await lido.priceOracle.scaledBalance(yieldToken, 2);
      let numYieldTokens = await lido.priceOracle.numYieldTokensPerAsset(yieldToken, 3);
      expect(exchangeRate).to.equal(1.0);
      expect(scaledBalance).to.equal(2);
      expect(numYieldTokens).to.equal(3);
    });
    
    it("Should give correct exchange rate from Compound", async () =>
    {
      let compound = await Comptroller.create('CErc20', 1000000);
      const yieldToken = compound.yieldToken;
      let exchangeRate = await compound.priceOracle.currentRate(yieldToken);
      let scaledBalance = await compound.priceOracle.scaledBalance(yieldToken, 2);
      let numYieldTokens = await compound.priceOracle.numYieldTokensPerAsset(yieldToken, 3);
      expect(exchangeRate).to.equal(1.0);
      expect(scaledBalance).to.equal(2);
      expect(numYieldTokens).to.equal(3);
    });
  });
});
