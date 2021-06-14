import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { toWei } from "./utils/Decimal";
import { ERC20 } from "./utils/ERC20";

describe("Tempus Pool", async () => {
  let owner, user;
  let yieldToken:ERC20, pool, principalShare:ERC20, yieldShare:ERC20;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    // TODO use actual yield bearing implementation
    let YieldBearingToken = await ethers.getContractFactory("ERC20FixedSupply");
    yieldToken = await ERC20.deploy("ERC20FixedSupply", "Yield Bearing Token", "YBT", toWei(1000000));
    // Pre-fund the user with 10000 tokens
    await yieldToken.transfer(owner, user, 10000);

    let TempusPool = await ethers.getContractFactory("TempusPool");
    // TODO: use block.timestamp
    let startTime = Date.now();
    let maturityTime = startTime + 60*60; // maturity is in 1hr
    pool = await TempusPool.connect(owner).deploy(yieldToken.address(), startTime, maturityTime);

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
      expect(await pool.initialExchangeRate()).to.equal(1);
      expect(await pool.currentExchangeRate()).to.equal(1);
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
  });
});
