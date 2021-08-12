import { ethers } from "hardhat";
import { expect } from "chai";
import { Aave } from "./utils/Aave";
import { Signer } from "./utils/ContractBase";
import { generateTempusSharesNames, TempusPool } from "./utils/TempusPool";
import { blockTimestamp } from "./utils/Utils";

describe("Tempus Pool (YieldShare)", async () => {
  let owner:Signer, user:Signer;
  let aave:Aave;
  let pool:TempusPool;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    createAavePool();
  });

  async function createAavePool(liquidityIndex:number = 1.0, depositToUser:number = 0) {
    aave = await Aave.create(1000000);
    await aave.asset.transfer(owner, user, 10000); // initial deposit for User

    // set starting rate
    await aave.setLiquidityIndex(liquidityIndex, owner);

    // generate some ATokens by owner depositing, and then transfer some to user
    if (depositToUser > 0) {
      await aave.deposit(owner, depositToUser*2);
      await aave.yieldToken.transfer(owner, user, depositToUser);
    }

    let maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    const names = generateTempusSharesNames("aToken", "aTKN", maturityTime);
    pool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime, names);
  }

  describe("Deploy", async () =>
  {
    it("Should have 1.0 Principal rate and 0.0 Yield rate at init", async () =>
    {
      await createAavePool();
      expect(await pool.principalShare.getPricePerFullShare()).to.equal(1.0);
      expect(await pool.yieldShare.getPricePerFullShare()).to.equal(0.0);
    });
  });

});
