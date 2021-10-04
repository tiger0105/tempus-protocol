import { run, ethers } from 'hardhat';
import * as prompt from "prompt";
import * as chalk from "chalk";

if (!process.env.ETHERSCAN_API_KEY) {
  throw new Error("ETHERSCAN_API_KEY env var must be defined");
}

async function tryVerifyingSource(contractName: string, contractAddress: string, constructorArgs: any[]) {
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArgs
    });
    console.log(chalk.green(`Successfully verified ${contractName} on Etherscan - ${contractAddress}`));
  }
  catch (e) {
    if (e.message.includes("Contract source code already verified")) {
      console.log(chalk.yellow(`${contractName} source code is already verified on Etherscan`))
      return;
    }
    throw e;
  }
}

async function main() {
  console.log(chalk.green("Verifying LidoTempusPool on Etherscan..."));

  const { tempusAmmAddress } = await prompt.get(["tempusAmmAddress"]);

  const tempusAMM = await ethers.getContractAt("TempusAMM", tempusAmmAddress);
  const poolAddress = await tempusAMM.tempusPool();
  
  const tempusPool = await ethers.getContractAt("LidoTempusPool", poolAddress);
  const principals = await ethers.getContractAt("PrincipalShare", await tempusPool.principalShare());
  const yields = await ethers.getContractAt("YieldShare", await tempusPool.yieldShare());

  
  console.log(chalk.yellow("Please enter the constructor required constructor arguments that were used to deploy TempusAMM"));
  const { pauseWindowDuration, bufferPeriodDuration } = await prompt.get(['pauseWindowDuration', 'bufferPeriodDuration'])
  
  console.log(chalk.yellow("Please enter the constructor required constructor arguments that were used to deploy LidoTempusPool"));
  const { 
    estYield,
    depositPercent,
    earlyRedeemPercent,
    matureRedeemPercent,
    referrerAddress
  } = await prompt.get(['estYield', 'depositPercent', 'earlyRedeemPercent', 'matureRedeemPercent', 'referrerAddress'])
  
  const tempusPoolConstructorArgs = await Promise.all([
    tempusPool.yieldBearingToken(),
    tempusPool.controller(),
    tempusPool.maturityTime(),
    estYield,
    principals.name(),
    principals.symbol(),
    yields.name(),
    yields.symbol(),
    {
      depositPercent,
      earlyRedeemPercent,
      matureRedeemPercent
    },
    referrerAddress
  ]);

  const tempusAMMConstructorArgs = await Promise.all([
    tempusAMM.getVault(),
    tempusAMM.name(),
    tempusAMM.symbol(),
    tempusPool.address,
    (async () => {
      const { value, precision } = await tempusAMM.getAmplificationParameter();
      return value.div(precision);
    })(),
    tempusAMM.getSwapFeePercentage(),
    pauseWindowDuration,
    bufferPeriodDuration,
    tempusAMM.owner()
  ]);
//   {
//     vault: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
//     name: "Tempus stETH LP Token",
//     symbol: "TLPstETH",
//     pool: "0x8A326f00944972F4a218Cc6062D62f093D0490a7",
//     amplificationParameter: 5,
//     swapFeePercentage: toWei(0.01),
//     pauseWindowDuration: 3 * MONTH,
//     bufferPeriodDuration: MONTH,
//     owner: "0x6b5975f46a266f58a7a43da2705d34e1998f7299"
// }
  await tryVerifyingSource("TempusAMM", tempusAMM.address, tempusAMMConstructorArgs);
  await tryVerifyingSource("LidoTempusPool", poolAddress, tempusPoolConstructorArgs);
  await tryVerifyingSource("PrincipalShare", principals.address, await Promise.all([tempusPool.address, principals.name(), principals.symbol(), principals.decimals()]));
  await tryVerifyingSource("YieldShare", yields.address, await Promise.all([tempusPool.address, yields.name(), yields.symbol(), yields.decimals()]));
}

main()
