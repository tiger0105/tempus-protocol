import { expect } from "chai";
import { Signer } from "../utils/ContractBase";
import { TempusPool } from "../utils/TempusPool";
import { describeForEachPool } from "../pool-utils/MultiPoolTestSuite";
import { ITestPool } from "../pool-utils/ITestPool";
import { Stats } from "../utils/Stats";

describeForEachPool("Stats", (testPool:ITestPool) =>
{
  let owner:Signer, user1:Signer, user2:Signer;
  let pool:TempusPool;
  let stats:Stats;

  beforeEach(async () =>
  {
    pool = await testPool.createDefault();
    [owner, user1, user2] = testPool.signers;
    stats = await Stats.create();
  });

  it("Estimated Minted Shares returns expected values", async () =>
  {
    expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/false)).to.equal(10, "1x shares minting YBT with rate 1.0");
    expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/true )).to.equal(10, "1x shares minting BT with rate 1.0");

    await testPool.setInterestRate(2.0);
    if (testPool.yieldPeggedToAsset)
    {
      expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/false)).to.equal(5, "0.5x shares minting YBT with rate 2.0");
      expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/true )).to.equal(5, "0.5x shares minting BT with rate 2.0");
    }
    else
    {
      expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/false)).to.equal(10, "1x shares minting YBT with rate 2.0");
      expect(await stats.estimatedMintedShares(testPool, 10, /*BT*/true )).to.equal(5, "0.5x shares minting BT with rate 2.0");
    }
  });

});
