import { ethers } from "hardhat";
import { expect } from "chai";
import { toWei } from "./utils/Decimal";
import { ContractBase, Signer } from "./utils/ContractBase";
import { IPriceOracle } from "./utils/IPriceOracle";
import { ERC20 } from "./utils/ERC20";

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
      const aavePool = await ContractBase.deployContract("AavePoolMock", backingAsset.address());
      const yieldToken = await ERC20.attach("ATokenMock", await aavePool.yieldToken());

      let oracle:IPriceOracle = await IPriceOracle.deploy("AavePriceOracle");
      let exchangeRate = await oracle.currentRate(yieldToken);
      expect(exchangeRate).to.equal(1.0);
    });

    it("Should give correct exchange rate from Lido", async () =>
    {
      const pool = await ContractBase.deployContract("LidoMock");
      let oracle:IPriceOracle = await IPriceOracle.deploy("StETHPriceOracle");
      let exchangeRate = await oracle.currentRate(pool.address);
      expect(exchangeRate).to.equal(1.0);
    });
    
    it("Should give correct exchange rate from Compound", async () =>
    {
      const backingAsset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(1000000));
      const pool = await ContractBase.deployContract("ComptrollerMock", backingAsset.address());
      const yieldToken = await ERC20.attach("CErc20", await pool.yieldToken());

      let oracle:IPriceOracle = await IPriceOracle.deploy("CompoundPriceOracle");
      let exchangeRate = await oracle.currentRate(yieldToken);
      expect(exchangeRate).to.equal(1.0);
    });
  });
});
