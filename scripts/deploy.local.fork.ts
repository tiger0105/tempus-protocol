// External libraries
import { ethers, network, getNamedAccounts } from 'hardhat';

// Test Utils
import { ERC20 } from '../test/utils/ERC20';
import { generateTempusSharesNames, TempusPool } from '../test/utils/TempusPool';
import { ContractBase } from '../test/utils/ContractBase';
import { TempusController } from '../test/utils/TempusController';
import { DAY, MONTH } from '../test/utils/TempusAMM';
import { toWei } from '../test/utils/Decimal';

class DeployLocalForked {
  static async deploy() {
    const owner = (await ethers.getSigners())[0];

    const aDaiToken = new ERC20("ERC20", (await ethers.getContract('aToken_Dai')));
    const cDaiToken = new ERC20("ERC20", (await ethers.getContract('cToken_Dai')));
    const stETHToken = new ERC20("ILido", (await ethers.getContract('Lido')));
  
    const latestBlock = await ethers.provider.getBlock('latest');
    console.log(`Latest block number: ${latestBlock.number}`);

    const maturityTimeOneYear = latestBlock.timestamp + DAY * 365;
    const maturityTimeOneMonth = latestBlock.timestamp + MONTH;

    // Deploy Tempus Controller
    const tempusController: TempusController = await TempusController.deploy();

    // Deploy Tempus pool backed by Aave (aDAI Token)
    const tempusPoolAave = await TempusPool.deployAave(
      aDaiToken,
      tempusController,
      maturityTimeOneYear,
      0.1, // yield estimate 
      generateTempusSharesNames("aDai aave token", "aDai", maturityTimeOneYear)
    );

    // Deploy Tempus pool backed by Aave (aDAI Token)
    const tempusPoolAave1 = await TempusPool.deployAave(
      aDaiToken,
      tempusController,
      maturityTimeOneMonth,
      0.01, // yield estimate 
      generateTempusSharesNames("aDai aave token", "aDai", maturityTimeOneMonth)
    );

    // Deploy Tempus pool backed by Compound (cDAI Token)
    const tempusPoolCompound = await TempusPool.deployCompound(
      cDaiToken,
      tempusController,
      maturityTimeOneYear,
      0.13, // yield estimate
      generateTempusSharesNames("cDai compound token", "cDai", maturityTimeOneYear)
    );

    // Deploy Tempus pool backed by Compound (cDAI Token)
    const tempusPoolCompound1 = await TempusPool.deployCompound(
      cDaiToken,
      tempusController,
      maturityTimeOneMonth,
      0.011, // yield estimate
      generateTempusSharesNames("cDai compound token", "cDai", maturityTimeOneMonth)
    );

    // Deploy Tempus pool backed by Lido (stETH Token)
    const tempusPoolLido = await TempusPool.deployLido(
      stETHToken,
      tempusController,
      maturityTimeOneYear,
      0.1, // yield estimate
      generateTempusSharesNames("Lido stETH", "stETH", maturityTimeOneYear)
    );

    // Deploy Tempus pool backed by Lido (stETH Token)
    const tempusPoolLido1 = await TempusPool.deployLido(
      stETHToken,
      tempusController,
      maturityTimeOneMonth,
      0.01, // yield estimate
      generateTempusSharesNames("Lido stETH", "stETH", maturityTimeOneMonth)
    );

    // Deploy TempusAMM for Aave TempusPool - we have one AMM per TempusPool
    let tempusAMMAave = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token",
      "LPaDAI",
      tempusPoolAave.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy TempusAMM for Aave TempusPool - we have one AMM per TempusPool
    let tempusAMMAave1 = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token 1",
      "LPaDAI1",
      tempusPoolAave1.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy TempusAMM for Compound TempusPool - we have one AMM per TempusPool
    let tempusAMMCompound = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token",
      "LPcDAI",
      tempusPoolCompound.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy TempusAMM for Compound TempusPool - we have one AMM per TempusPool
    let tempusAMMCompound1 = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token 1",
      "LPcDAI1",
      tempusPoolCompound1.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy TempusAMM for Lido TempusPool - we have one AMM per TempusPool
    let tempusAMMLido = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token",
      "LPstETH",
      tempusPoolLido.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy TempusAMM for Lido TempusPool - we have one AMM per TempusPool
    let tempusAMMLido1 = await ContractBase.deployContract(
      "TempusAMM",
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      "Tempus LP token 1",
      "LPstETH1",
      tempusPoolLido1.address,
      5,
      toWei(0.002),
      3 * MONTH,
      MONTH,
      owner.address
    );

    // Deploy stats contract
    const statistics = await ContractBase.deployContract("Stats");

    // Log required information to console.
    console.log('=========== Aave Tempus Pool Info ===========');
    console.log(`Deployed TempusPool Aave contract at: ${tempusPoolAave.address}`);
    console.log(`TPS Aave deployed at: ${tempusPoolAave.principalShare.address}`)
    console.log(`TYS Aave deployed at: ${tempusPoolAave.yieldShare.address}`);
    console.log(`YBT Aave address: ${tempusPoolAave.yieldBearing.address}`);
    console.log(`Deployed TempusPool Aave AMM at: ${tempusAMMAave.address}`);
    console.log('---------------------------------------------');
    console.log(`Deployed TempusPool (second) Aave contract at: ${tempusPoolAave1.address}`);
    console.log(`TPS Aave deployed at: ${tempusPoolAave1.principalShare.address}`)
    console.log(`TYS Aave deployed at: ${tempusPoolAave1.yieldShare.address}`);
    console.log(`YBT Aave address: ${tempusPoolAave1.yieldBearing.address}`);
    console.log(`Deployed TempusPool Aave AMM at: ${tempusAMMAave1.address}`);
    console.log('=========== Compound Tempus Pool Info ===========');
    console.log(`Deployed TempusPool Compound contract at: ${tempusPoolCompound.address}`);
    console.log(`TPS Compound deployed at: ${tempusPoolCompound.principalShare.address}`)
    console.log(`TYS Compound deployed at: ${tempusPoolCompound.yieldShare.address}`);
    console.log(`YBT Compound address: ${tempusPoolCompound.yieldBearing.address}`);
    console.log(`Deployed TempusPool Compound AMM at: ${tempusAMMCompound.address}`);
    console.log('---------------------------------------------');
    console.log(`Deployed TempusPool (second) Compound contract at: ${tempusPoolCompound1.address}`);
    console.log(`TPS Compound deployed at: ${tempusPoolCompound1.principalShare.address}`)
    console.log(`TYS Compound deployed at: ${tempusPoolCompound1.yieldShare.address}`);
    console.log(`YBT Compound address: ${tempusPoolCompound1.yieldBearing.address}`);
    console.log(`Deployed TempusPool Compound AMM at: ${tempusAMMCompound1.address}`);
    console.log('=========== Lido Tempus Pool Info ===========');
    console.log(`Deployed TempusPool Lido contract at: ${tempusPoolLido.address}`);
    console.log(`TPS Lido deployed at: ${tempusPoolLido.principalShare.address}`)
    console.log(`TYS Lido deployed at: ${tempusPoolLido.yieldShare.address}`);
    console.log(`YBT Lido address: ${tempusPoolLido.yieldBearing.address}`);
    console.log(`Deployed TempusPool Lido AMM at: ${tempusAMMLido.address}`);
    console.log('---------------------------------------------');
    console.log(`Deployed TempusPool (second) Lido contract at: ${tempusPoolLido1.address}`);
    console.log(`TPS Lido deployed at: ${tempusPoolLido1.principalShare.address}`)
    console.log(`TYS Lido deployed at: ${tempusPoolLido1.yieldShare.address}`);
    console.log(`YBT Lido address: ${tempusPoolLido1.yieldBearing.address}`);
    console.log(`Deployed TempusPool Lido AMM at: ${tempusAMMLido1.address}`);
    console.log('=========== Singleton Contracts Info ========');
    console.log(`Deployed Stats contract at: ${statistics.address}`);
    console.log(`Deployed TempusController at: ${tempusController.address}`);
  }
}
DeployLocalForked.deploy();
