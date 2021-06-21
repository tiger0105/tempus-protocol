import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { toWei } from "./utils/Decimal";
import { ERC20 } from "./utils/ERC20";

describe("Tempus Pool", async () => {
  let owner, user;
  let aavePool, yieldToken:ERC20;
  let pool, principalShare:ERC20, yieldShare:ERC20;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    // TODO use actual yield bearing implementation
    let BackingToken = await ethers.getContractFactory("ERC20FixedSupply");
    let aaveBackingAsset = await BackingToken.deploy("DAI Stablecoin", "DAI", toWei(1000000));

    let AavePoolMock = await ethers.getContractFactory("AavePoolMock");
    aavePool = await AavePoolMock.deploy(aaveBackingAsset.address);

    yieldToken = await ERC20.attach("ATokenMock", await aavePool.yieldToken());

    // Pre-fund the user with 10000 backing tokens, and enter the pool
    await aaveBackingAsset.connect(owner).transfer(user.address, toWei(10000));
    await aaveBackingAsset.connect(user).approve(aavePool.address, toWei(1000));
    await aavePool.connect(user).deposit(aaveBackingAsset.address, toWei(1000), user.address, 0);

    let AavePriceOracle = await ethers.getContractFactory("AavePriceOracle");
    let priceOracle = await AavePriceOracle.deploy();

    let TempusPool = await ethers.getContractFactory("TempusPool");
    // TODO: use block.timestamp
    let startTime = Date.now();
    let maturityTime = startTime + 60*60; // maturity is in 1hr
    pool = await TempusPool.connect(owner).deploy(yieldToken.address(), priceOracle.address, startTime, maturityTime);

    principalShare = await ERC20.attach("PrincipalShare", await pool.principalShare());

    yieldShare = await ERC20.attach("YieldShare", await pool.yieldShare());
  });

  async function deposit(amount) {
    return pool.connect(user).deposit(toWei(amount));
  }

  describe("Deploy", async () =>
  {
    it("Initial exchange rate should be set", async () =>
    {
      expect(await pool.initialExchangeRate()).to.equal(ethers.utils.parseUnits("1.0", 27));
      expect(await pool.currentExchangeRate()).to.equal(ethers.utils.parseUnits("1.0", 27));
    });
  });

  describe("Deposit", async () =>
  {
    it("Should allow depositing 100", async () =>
    {
      await yieldToken.approve(user, pool, 100);
      await deposit(100);
      expect(await principalShare.balanceOf(user.address)).to.equal(100);
      expect(await yieldShare.balanceOf(user.address)).to.equal(100);
    });

    it("Should allow depositing 100 again", async () =>
    {
      await yieldToken.approve(user, pool, 200);
      await deposit(100);
      expect(await principalShare.balanceOf(user.address)).to.equal(100);
      expect(await yieldShare.balanceOf(user.address)).to.equal(100);
      await deposit(100);
      expect(await principalShare.balanceOf(user.address)).to.equal(200);
      expect(await yieldShare.balanceOf(user.address)).to.equal(200);
    });

    it("Depositing after AAVE increase", async () =>
    {
      await yieldToken.approve(user, pool, 200);
      await deposit(100);
      expect(await principalShare.balanceOf(user.address)).to.equal(100);
      expect(await yieldShare.balanceOf(user.address)).to.equal(100);

      await aavePool.connect(owner).setLiquidityIndex("2000000000000000000000000000");
      await deposit(100);
      expect(await principalShare.balanceOf(user.address)).to.equal(150);
      expect(await yieldShare.balanceOf(user.address)).to.equal(150);

      expect(await pool.initialExchangeRate()).to.equal(ethers.utils.parseUnits("1.0", 27));
      expect(await pool.currentExchangeRate()).to.equal(ethers.utils.parseUnits("2.0", 27));
    });
  });
});
