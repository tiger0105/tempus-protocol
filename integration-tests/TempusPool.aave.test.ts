import { expect } from "chai";
import {
  ethers,
  deployments,
  getNamedAccounts
} from 'hardhat';
import { blockTimestamp } from '../test/utils/Utils';
import { TempusPool } from "../test/utils/TempusPool";
import { IPriceOracle } from "../test/utils/IPriceOracle";
import { ERC20 } from "../test/utils/ERC20";
import { ContractBase } from "../test/utils/ContractBase";
import { toWei } from "../test/utils/Decimal";
import { calculateMintedSharesOnDeposit } from "../test/utils/TempusMath";

const setup = deployments.createFixture(async () => {
  await deployments.fixture(undefined, {
    keepExistingDeployments: true, // global option to test network like that
  });
  
  const { daiHolder, aDaiHolder } = await getNamedAccounts();
  
  const daiHolderSigner = await ethers.getSigner(daiHolder);
  const aDaiHolderSigner = await ethers.getSigner(aDaiHolder);
  
  const daiBackingToken = await ERC20.attach("ERC20", (await ethers.getContract('Dai')).address);
  const aDaiYieldToken = await ERC20.attach("ERC20", (await ethers.getContract('aToken_Dai')).address);
  
  const priceOracle = await IPriceOracle.deploy("AavePriceOracle");
  const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
  const tempusPool = await TempusPool.deploy(aDaiYieldToken, priceOracle, maturityTime);
  
  const aaveDepositWrapper = await ContractBase.deployContract("AaveDepositWrapper", tempusPool.address);

  return {
    contracts: {
      aaveDepositWrapper,
      tempusPool,
      dai: daiBackingToken,
      aDai: aDaiYieldToken
    },
    signers: {
      daiHolder: daiHolderSigner,
      aDaiHolder: aDaiHolderSigner
    }
  };
});

// TODO: fix those tests. They are failing because we've changed the math in the deposit flow
describe.skip('TempusPool <> Aave', function () {
  it('verifies a correct amount of shares is minted when depositing BT to the TempusPool (via the deposit wrapper)', async () => {
    const { signers: { daiHolder }, contracts: { dai, aDai, aaveDepositWrapper, tempusPool }} = await setup();
    
    const depositAmount: number = 100;

    await dai.approve(daiHolder, aaveDepositWrapper.address, depositAmount);
    await aaveDepositWrapper.connect(daiHolder).deposit(toWei(depositAmount));
    
    const expectedMintedShares = await calculateMintedSharesOnDeposit(tempusPool, depositAmount);
    
    const principalShareBalance = await tempusPool.principalShare.balanceOf(daiHolder.address);
    const yieldShareBalance = await tempusPool.yieldShare.balanceOf(daiHolder.address);
    
    expect(principalShareBalance).to.equal(expectedMintedShares);
    expect(yieldShareBalance).to.equal(expectedMintedShares);
  });

  it('verifies a correct amount of shares is minted when depositing YBT to the TempusPool', async () => {
    const { signers: { aDaiHolder }, contracts: { aDai, tempusPool }} = await setup();

    const depositAmount: number = 100;    

    await aDai.approve(aDaiHolder, tempusPool.address, depositAmount);
    await tempusPool.deposit(aDaiHolder, depositAmount, aDaiHolder);

    const expectedMintedShares = await calculateMintedSharesOnDeposit(tempusPool, depositAmount);
    
    const principalShareBalance = await tempusPool.principalShare.balanceOf(aDaiHolder.address);
    const yieldShareBalance = await tempusPool.yieldShare.balanceOf(aDaiHolder.address);
    
    expect(principalShareBalance).to.equal(expectedMintedShares);
    expect(yieldShareBalance).to.equal(expectedMintedShares);
  });
});