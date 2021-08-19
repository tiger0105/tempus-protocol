import { expect } from "chai";
import {
  ethers,
  deployments,
  getNamedAccounts
} from 'hardhat';
import { BigNumber } from '@ethersproject/bignumber';
import * as NameHash from 'eth-ens-namehash';
import { blockTimestamp } from '../../test/utils/Utils';
import { generateTempusSharesNames, TempusPool } from "../../test/utils/TempusPool";
import { IPriceOracle } from "../../test/utils/IPriceOracle";
import { ERC20 } from "../../test/utils/ERC20";
import { ContractBase } from "../../test/utils/ContractBase";
import { toWei } from '../../test/utils/Decimal';
import { EthPriceQuoteProvider } from '../EthPriceQuoteProvider';

if (!process.env.HARDHAT_FORK_NUMBER) {
  throw new Error('HARDHAT_FORK_NUMBER env var is not defined');
}
const FORKED_BLOCK_NUMBER = Number(process.env.HARDHAT_FORK_NUMBER);

const setup = deployments.createFixture(async () => {
  await deployments.fixture(undefined, {
    keepExistingDeployments: true, // global option to test network like that
  });

  const { aWethHolder } = await getNamedAccounts();
  
  const aWethHolderSigner = await ethers.getSigner(aWethHolder);
  
  const aWethYieldToken = new ERC20("ERC20", (await ethers.getContract('aToken_Weth')));
  
  const priceOracle = await IPriceOracle.deploy("AavePriceOracle");
  const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr

  const names = generateTempusSharesNames("Aave wrapped ether", "aWETH", maturityTime);
  const yieldEst = 0.1;
  const tempusPool = await TempusPool.deployAave(aWethYieldToken, priceOracle, maturityTime, yieldEst, names);
  
  const stats = await ContractBase.deployContract("Stats");

  return {
    contracts: {
      tempusPool,
      aWeth: aWethYieldToken,
      stats
    },
    signers: {
      aWethHolder: aWethHolderSigner
    }
  };
});

describe('Stats <> Chainlink', function () {
  it('verifies querying the TVL of a pull in USD denominations returns a correct result', async () => {
    // arrange
    const { signers: { aWethHolder }, contracts: { aWeth, tempusPool, stats }} = await setup();
    const depositAmount: number = 1234.56789;
    const chainlinkAggregatorEnsHash = NameHash.hash("eth-usd.data.eth");
    const currentBlockDate = new Date(1000 * (await ethers.provider.getBlock(FORKED_BLOCK_NUMBER)).timestamp);
    const ethPriceQuote = await EthPriceQuoteProvider.getDailyQuote(currentBlockDate);
    
    // act
    await aWeth.approve(aWethHolder, tempusPool.address, depositAmount);
    await tempusPool.deposit(aWethHolder, depositAmount, aWethHolder);
    
    // assert
    const totalValueLockedInUSD :BigNumber = await stats.totalValueLockedAtGivenRate(tempusPool.address, chainlinkAggregatorEnsHash);
    const minExpectedTotalValueLockedInUSD = Number(toWei(depositAmount).mul(toWei(ethPriceQuote.low)).div(toWei(1)));
    const maxExpectedTotalValueLockedInUSD = Number(toWei(depositAmount).mul(toWei(ethPriceQuote.high)).div(toWei(1)));

    expect(Number(totalValueLockedInUSD)).to.be.within(minExpectedTotalValueLockedInUSD, maxExpectedTotalValueLockedInUSD);
  }).timeout(60000);
})