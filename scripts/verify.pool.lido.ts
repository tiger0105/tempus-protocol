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

  const { poolAddress } = await prompt.get(["poolAddress"]);

  const tempusPool = await ethers.getContractAt("LidoTempusPool", poolAddress);  
  const principals = await ethers.getContractAt("PrincipalShare", await tempusPool.principalShare());
  const yields = await ethers.getContractAt("YieldShare", await tempusPool.yieldShare());

  const { 
    estYield,
    depositPercent,
    earlyRedeemPercent,
    matureRedeemPercent,
    referrerAddress
  } = await prompt.get(['estYield', 'depositPercent', 'earlyRedeemPercent', 'matureRedeemPercent', 'referrerAddress'])
  
  const constructorArgs = await Promise.all([
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
  
  await tryVerifyingSource("LidoTempusPool", poolAddress, constructorArgs);
  await tryVerifyingSource("PrincipalShare", principals.address, await Promise.all([tempusPool.address, principals.name(), principals.symbol(), principals.decimals()]));
  await tryVerifyingSource("YieldShare", yields.address, await Promise.all([tempusPool.address, yields.name(), yields.symbol(), yields.decimals()]));
}

main()
