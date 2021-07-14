import { ethers } from "hardhat";
import { toWei } from "./../test/utils/Decimal";
import { Aave } from "../test/utils/Aave";
import { TempusPool } from "./../test/utils/TempusPool";

async function blockTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function main() {
  const [owner, user] = await ethers.getSigners();

  /// aToken pool

  const aave:Aave = await Aave.create(1000000);
  await aave.asset.transfer(owner, user, 10000); // initial deposit for User
  // set starting rate
  await aave.setLiquidityIndex(100);

  // generate some ATokens by owner depositing, and then transfer some to user
  await aave.deposit(owner, 200000);
  await aave.yieldToken.transfer(owner, user, 1000);

  const maturityTime = await blockTimestamp() + 60*60*24*30; // maturity is in 30 days
  const pool:TempusPool = await TempusPool.deploy(aave.yieldToken, aave.priceOracle, maturityTime);

  console.log('TempusPool for Aave AToken data');
  console.log('  TempusPool deployed to:    ', pool.address());
  console.log('  Aave pool deployed to:     ', aave.address());
  console.log('  Backing token deployed to: ', aave.asset.address());
  console.log('  YBT deployed to:           ', aave.yieldToken.address());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });