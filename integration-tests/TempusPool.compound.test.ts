import { expect } from "chai";
import {
  ethers,
  deployments,
  getNamedAccounts,
  getUnnamedAccounts
} from 'hardhat';
import { blockTimestamp, evmMine, evmSetAutomine, increaseTime } from '../test/utils/Utils';
import { generateTempusSharesNames, TempusPool } from "../test/utils/TempusPool";
import { ERC20 } from "../test/utils/ERC20";
import { TempusController } from "../test/utils/TempusController";
import { fromWei, toWei } from "../test/utils/Decimal";
import Decimal from "decimal.js";

const setup = deployments.createFixture(async () => {
  await deployments.fixture(undefined, {
    keepExistingDeployments: true, // global option to test network like that
  });
  
  const { daiHolder } = await getNamedAccounts();
  const [ account1, account2 ] = await getUnnamedAccounts();
  const daiHolderSigner = await ethers.getSigner(daiHolder);

  const daiBackingToken = new ERC20("ERC20FixedSupply", (await ethers.getContract('Dai')));
  const cDaiYieldToken = new ERC20("ICErc20", (await ethers.getContract('cToken_Dai')));
  
  const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
  const names = generateTempusSharesNames("cDai compound token", "cDai", maturityTime);
  const yieldEst = 0.1;
  const controller: TempusController = await TempusController.deploy();
  const tempusPool = await TempusPool.deployCompound(cDaiYieldToken, controller, maturityTime, yieldEst, names);
  
  await daiBackingToken.transfer(daiHolderSigner, account1, 100000);
  await daiBackingToken.transfer(daiHolderSigner, account2, 100000);

  return {
    contracts: {
      tempusPool,
      dai: daiBackingToken,
      cDai: cDaiYieldToken
    },
    signers: {
      daiHolder: daiHolderSigner,
      signer1: await ethers.getSigner(account1),
      signer2: await ethers.getSigner(account2)
    }
  };
});

describe('TempusPool <> Compound', function () {
  it('Verifies that depositing directly to Compound accrues equal interest compared to depositing via TempusPool', async () => {
    // The maximum discrepancy to allow between accrued interest from depositing directly to Compound
    //    vs depositing to Compound via TempusPool
    const MAX_ALLOWED_INTEREST_DELTA_ERROR = 1e-6; // 0.000001% error
    const { signers: { signer1, signer2 }, contracts: { dai, cDai, tempusPool }} = await setup();
    expect(await cDai.balanceOf(signer1)).to.equal(0);
    expect(await cDai.balanceOf(signer2)).to.equal(0);
    
    
    const depositAmount: number = 100;
    await dai.approve(signer1, tempusPool.controller.address, depositAmount);
    await dai.approve(signer2, cDai.address, depositAmount);
    await dai.approve(signer2, tempusPool.controller.address, "12345.678901234");
    await tempusPool.controller.depositBacking(signer2, tempusPool, "12345.678901234"); // deposit some BT to the pool before 
    
    const btBalancePreSigner1 = await dai.balanceOf(signer1.address);
    const btBalancePreSigner2 = await dai.balanceOf(signer2.address);
    
    await evmSetAutomine(false);
    await tempusPool.controller.depositBacking(signer1, tempusPool, depositAmount); // deposit some BT to the pool before 
    await cDai.connect(signer2).mint(toWei(depositAmount)); // deposit directly to Compound
    await evmMine();
    await evmSetAutomine(true);
    
    // mine a bunch of blocks to accrue interest
    for (let i = 0; i < 10000; i++) {
      await evmMine();
    }
    
    const yieldShareBalanceSigner1 = await tempusPool.yieldShare.balanceOf(signer1);

    await evmSetAutomine(false);
    
    await tempusPool.controller.redeemToBacking(signer1, tempusPool, yieldShareBalanceSigner1, yieldShareBalanceSigner1);
    await cDai.connect(signer2).redeem((await cDai.contract.balanceOf(signer2.address)));
    await evmMine();
    await evmSetAutomine(true);

    const btBalancePostSigner1 = await dai.balanceOf(signer1);
    const btBalancePostSigner2 = await dai.balanceOf(signer2);
    const totalInterestSigner1 = toWei(btBalancePostSigner1).sub(toWei(btBalancePreSigner1));
    const totalInterestSigner2 = toWei(btBalancePostSigner2).sub(toWei(btBalancePreSigner2));
    
    const error = new Decimal(1).sub(new Decimal(fromWei(totalInterestSigner2).toString())
      .div(fromWei(totalInterestSigner1).toString())).abs()
    
    expect(error.lessThanOrEqualTo(MAX_ALLOWED_INTEREST_DELTA_ERROR)).is.true;
  });
});