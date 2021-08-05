import { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase } from "./../utils/ContractBase";
import { BigNumber, Contract } from "ethers";
import { fromWei, NumberOrString, toWei } from "./../utils/Decimal";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { TempusAMM } from "../utils/TempusAMM"

describe("TempusPool", async () => {
  let owner:SignerWithAddress;

  beforeEach(async () => {
    [owner] = await ethers.getSigners();
  });

  it("checks LP's pool token balance is greater than 0", async () => {
    const FEE_PERC = 0.02;
    let amplification = 5;
    let totalSharesSupply = 1000000;
    const tempusAMM = await TempusAMM.create(owner, amplification, FEE_PERC, totalSharesSupply);
    await tempusAMM.setPricePerShares(1, 0.1);
    await tempusAMM.provideInitialLiquidity(owner, 100, 1000);
    const poolTokensBalance = await tempusAMM.balanceOf(owner);
    expect(poolTokensBalance).to.be.greaterThan(0);
  });

  it("tests basic swap", async () => {
    const FEE_PERC = 0.02;
    let amplification = 5;
    let totalSharesSupply = 1000000;
    const tempusAMM = await TempusAMM.create(owner, amplification, FEE_PERC, totalSharesSupply);
    await tempusAMM.setPricePerShares(1, 0.1);
    await tempusAMM.provideInitialLiquidity(owner, 1000, 10000);
    
    const amount = 1;
    const fee = toWei(0.02);
    const actualAmountIn = 0.98;
    let expectedAmountOutMin:number = 9.7983;
    let expectedAmountOutMax:number = 9.7984;
      
    const preSwapTPSBalance: BigNumber = await tempusAMM.principalShare.balanceOf(owner.address);
    const preSwapTYSBalance: BigNumber = await tempusAMM.yieldShare.balanceOf(owner.address);
      
    await tempusAMM.swapGivenIn(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, amount);
      
    const postSwapTPSBalance:BigNumber = await tempusAMM.principalShare.balanceOf(owner.address);
    const postSwapTYSBalance:BigNumber = await tempusAMM.yieldShare.balanceOf(owner.address);
      
    expect(preSwapTPSBalance.sub(postSwapTPSBalance).toString()).to.equal(toWei(amount).toString());
    const swapAmountOut = postSwapTYSBalance.sub(preSwapTYSBalance);
    expect(+fromWei(swapAmountOut)).to.be.within(expectedAmountOutMin, expectedAmountOutMax);
  });
});
