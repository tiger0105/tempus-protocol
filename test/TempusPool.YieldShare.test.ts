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
    const yieldEst = 0.1;
    pool = await TempusPool.deployAave(aave.yieldToken, maturityTime, yieldEst, names);
  }

  describe("Deploy", async () =>
  {
    it("correct rates for Yields and Principals", async () =>
    {
      await createAavePool();
      let principalPrice:number = +await pool.principalShare.getPricePerFullShareStored();
      let yieldsPrice:number = +await pool.yieldShare.getPricePerFullShareStored();
      expect(principalPrice).to.be.within(0.9090909090, 0.9090909091);
      expect(yieldsPrice).to.be.within(0.090909090, 0.090909091);
      expect(principalPrice + yieldsPrice).to.be.equal(1);
    });
  });

});
