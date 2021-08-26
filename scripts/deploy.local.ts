import { blockTimestamp } from "./../test/utils/Utils";
import { Aave } from "../test/utils/Aave";
import { generateTempusSharesNames, TempusPool } from "./../test/utils/TempusPool";
import { TempusController } from "./../test/utils/TempusController";

async function deployAavePool(
  backingTokenSupply: Number,
  initialLiquidityIndex: Number
): Promise<Aave> {
  const aave:Aave = await Aave.create(backingTokenSupply);
  
  // set starting rate
  await aave.setLiquidityIndex(initialLiquidityIndex);

  console.log('Aave pool deployed to: ', aave.address);
  console.log('Backing token deployed to: ', aave.asset.address);
  console.log('YBT deployed to: ', aave.yieldToken.address);

  return aave;
}

async function deployATokenTempusPool(aave: Aave, poolDurationSeconds: number) {
  const maturityTime = await blockTimestamp() + poolDurationSeconds;
  
  const names = generateTempusSharesNames("aToken", "aTKN", maturityTime);
  const yieldEst = 0.1;
  const controller: TempusController = await TempusController.deploy();
  const pool:TempusPool = await TempusPool.deployAave(aave.yieldToken, controller, maturityTime, yieldEst, names);

  console.log('AToken TempusPool deployed with length %i sec to: %s', poolDurationSeconds, pool.address);
}

async function main() {
  // deploy multiple aave pools
  const aave:Aave = await deployAavePool(1000000, 100);
  // deploy one month pool
  await deployATokenTempusPool(aave, 60*60*24*30);
  // deploy one year pool
  await deployATokenTempusPool(aave, 60*60*24*365);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
