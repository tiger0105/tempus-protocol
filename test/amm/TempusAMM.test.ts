import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { fromWei, toWei } from "./../utils/Decimal";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { TempusAMM } from "./../utils/TempusAMM"
import { ERC20 } from "./../utils/ERC20";
import { blockTimestamp, expectRevert, increaseTime } from "./../utils/Utils";
import exp = require("constants");
import { TempusPool } from "test/utils/TempusPool";

interface SwapTestRun {
  amplification:Number;
  pricePerPrincipal:Number;
  pricePerYield:Number;
  balancePrincipal:Number;
  balanceYield:Number;
  swapAmountIn:Number;
  swapAmountOut: Number;
}

const SWAP_FEE_PERC:Number = 0.02;

let principalShare:ERC20;
let yieldShare:ERC20;

async function checkSwap(owner:SignerWithAddress, swapTest:SwapTestRun, principalIn:boolean, givenIn: boolean) {
  const tempusAMM = await TempusAMM.create(owner, swapTest.amplification, SWAP_FEE_PERC, principalShare, yieldShare);
  await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(swapTest.pricePerPrincipal));
  await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(swapTest.pricePerYield));
  await tempusAMM.provideLiquidity(owner, swapTest.balancePrincipal, swapTest.balanceYield, true);

  const [tokenIn, tokenOut] = 
    principalIn ? 
    [tempusAMM.principalShare, tempusAMM.yieldShare] : 
    [tempusAMM.yieldShare, tempusAMM.principalShare];
      
  const preSwapTokenInBalance:BigNumber = await tokenIn.contract.balanceOf(owner.address);
  const preSwapTokenOutBalance:BigNumber = await tokenOut.contract.balanceOf(owner.address);

  if (givenIn) {
    await tempusAMM.swapGivenIn(owner, tokenIn.address, tokenOut.address, swapTest.swapAmountIn);
  } else {
    await tempusAMM.swapGivenOut(owner, tokenIn.address, tokenOut.address, swapTest.swapAmountOut);
  }
      
  const postSwapTokenInBalance:BigNumber = await tokenIn.contract.balanceOf(owner.address);
  const postSwapTokenOutBalance:BigNumber = await tokenOut.contract.balanceOf(owner.address);

  expect(+fromWei(preSwapTokenInBalance.sub(postSwapTokenInBalance))).to.equal(swapTest.swapAmountIn);
  expect(+fromWei(postSwapTokenOutBalance.sub(preSwapTokenOutBalance))).to.be.equal(swapTest.swapAmountOut);
}

describe("TempusAMM", async () => {
  let owner:SignerWithAddress;
  let user:SignerWithAddress;
  let user1:SignerWithAddress;

  beforeEach(async () => {
    [owner, user, user1] = await ethers.getSigners();

    const totalSharesSupply = 10000000;
    principalShare = await ERC20.deploy("TempusShareMock", "Tempus Principal", "TPS");
    await principalShare.connect(owner).mint(owner.address, toWei(totalSharesSupply));
    yieldShare = await ERC20.deploy("TempusShareMock", "Tempus Yield", "TYS");
    await yieldShare.connect(owner).mint(owner.address, toWei(totalSharesSupply));
  });

  it("checks amplification and invariant in multiple stages", async () => {
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    let [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(invariant).to.equal(0);
    expect(amplification).to.equal(0);
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(invariant).to.equal(toWei(200));
    expect(amplification).to.equal(5000);
  });

  it("checks amplification increases over time", async () => {
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.startAmplificationUpdate(95, (await blockTimestamp()) + 60*60*24*30);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    let [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(invariant).to.equal(toWei(200));
    expect(amplification).to.equal(5000);
    // move half period of pool duration
    await increaseTime(60*60*24*15);
    await tempusAMM.provideLiquidity(owner, 100, 1000, false);
    [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(invariant).to.equal(toWei(400));
    expect(amplification).to.equal(50000);
    // move to the end of the pool
    await increaseTime(60*60*24*15);
    await tempusAMM.provideLiquidity(owner, 100, 1000, false);
    [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(amplification).to.equal(95000);
  });

  it("checks amplification update reverts with invalid args", async () => {
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    
    // min amp 
    let invalidAmpUpdate = tempusAMM.startAmplificationUpdate(0, (await blockTimestamp()) + 0);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#300");

    // max amp 
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(1000000, (await blockTimestamp()) + 0);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#301");

    // min duration
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(65, (await blockTimestamp()) + 60);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#317");

    // stop update no ongoing update
    invalidAmpUpdate = tempusAMM.stopAmplificationUpdate();
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#320");

    // there is ongoing update
    await tempusAMM.startAmplificationUpdate(65, (await blockTimestamp()) + 60*60*24*30);
    await increaseTime(60*60*24*15);
    invalidAmpUpdate = tempusAMM.startAmplificationUpdate(95, (await blockTimestamp()) + 60*60*24*30);
    (await expectRevert(invalidAmpUpdate)).to.equal("BAL#318");

    // stop update
    await tempusAMM.stopAmplificationUpdate();
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    const [invariant, amplification] = await tempusAMM.getLastInvariant();
    expect(invariant).to.equal(toWei(200));
    expect(amplification).to.equal(35000);
  });

  it("checks LP's pool token balance", async () => {    
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    const poolTokensBalance = await tempusAMM.balanceOf(owner);
    expect(poolTokensBalance).to.be.equal(199.999999999999);
  });

  it("checks LP exiting pool", async () => {    
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    const preYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const prePrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(await tempusAMM.balanceOf(owner)).to.be.equal(199.999999999999);
    await tempusAMM.exitPoolExactLpAmountIn(owner, 100);
    expect(await tempusAMM.balanceOf(owner)).to.be.equal(99.999999999999);
    const postYieldBalance = +await tempusAMM.yieldShare.balanceOf(owner);
    const postPrincipalBalance = +await tempusAMM.principalShare.balanceOf(owner);
    expect(postPrincipalBalance - prePrincipalBalance).to.equal(50);
    expect(postYieldBalance - preYieldBalance).to.equal(500);
  });

  it("checks LP exiting pool for one token reverts", async () => {    
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);
    await expectRevert(tempusAMM.exitPoolExactLpAmountIn(owner, 100, true));
  });

  it("checks second LP's pool token balance without swaps between", async () => {
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);

    await tempusAMM.principalShare.transfer(owner, user.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user.address, 1000);
    await tempusAMM.provideLiquidity(user, 100, 1000, false);

    let balanceUser = await tempusAMM.balanceOf(user);
    let balanceOwner = await tempusAMM.balanceOf(owner);
    expect(balanceOwner).to.be.within(+balanceUser * 0.99999, +balanceUser * 1.000001);
  });

  it("checks second LP's pool token balance with swaps between", async () => {
    const tempusAMM = await TempusAMM.create(owner, 5 /*amp*/, SWAP_FEE_PERC, principalShare, yieldShare);
    await tempusAMM.principalShare.contract.setPricePerFullShare(toWei(1.0));
    await tempusAMM.yieldShare.contract.setPricePerFullShare(toWei(0.1));
    await tempusAMM.provideLiquidity(owner, 100, 1000, true);

    expect(await tempusAMM.balanceOf(owner)).to.be.equal(199.999999999999);

    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenOut(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 100);

    await tempusAMM.principalShare.transfer(owner, user.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user.address, 1000);
    await tempusAMM.provideLiquidity(user, 100, 1000, false);

    expect(+await tempusAMM.balanceOf(user)).to.be.equal(199.59926562946222);

    // do more swaps
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenOut(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenOut(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenOut(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 100);
    await tempusAMM.swapGivenIn(owner, tempusAMM.yieldShare.address, tempusAMM.principalShare.address, 100);
    await tempusAMM.swapGivenOut(owner, tempusAMM.principalShare.address, tempusAMM.yieldShare.address, 100);

    // provide more liquidity with different user
    await tempusAMM.principalShare.transfer(owner, user1.address, 1000);
    await tempusAMM.yieldShare.transfer(owner, user1.address, 1000);
    await tempusAMM.provideLiquidity(user1, 100, 1000, false);
    
    expect(+await tempusAMM.balanceOf(user1)).to.be.equal(198.795221425031305545);
  });

  it("test swaps principal in with balances aligned with exchange rate", async () => {
    const swapsTests:SwapTestRun[] = [
      // basic swap with exchange rate aligned to balances with increasing amplification
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.784018372524834},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.794000668498882},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.79733270625232},
      {amplification: 65, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.798544929018748},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.798999591380053},
      // swap big percentage of tokens
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 447.1895075296994},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 471.93679220142235},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 481.58295455148885},
      {amplification: 65, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 485.32301271038517},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 486.7614847043099}
    ];
    for (let i:number = 0; i < swapsTests.length; ++i) {
      await checkSwap(owner, swapsTests[i], true, true);
    }
  });

  it("tests swaps principal in with balances not aligned with exchange rate", async () => {
    const swapsTests:SwapTestRun[] = [
      // exchange rate doesn't match balances with increasing amplification
      {amplification: 2, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 6.272332951557398},
      {amplification: 4, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 5.715922328378409},
      {amplification: 6, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 5.48168727610396},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 5.154325593575289},
      {amplification: 25, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 5.056552331336089},
      {amplification: 40, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 4.999303750647578},
      {amplification: 60, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 4.966757609512131},
      {amplification: 85, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 4.947357157416658},
      // swap big percentage of tokens (this is going to make even bigger disbalance)
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 260.1918310953869},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 250.79346565959221},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 247.59037289049772},
      {amplification: 65, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 246.41609218445564},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 50, swapAmountOut: 245.97438693083}
    ];
    for (let i:number = 0; i < swapsTests.length; ++i) {
      await checkSwap(owner, swapsTests[i], true, true);
    }
  });

  it("tests swaps principal in with balances not aligned with exchange rate - different direction", async () => {
    const swapsTests:SwapTestRun[] = [
      // exchange rate doesn't match balances (different direction) with increasing amplification
      {amplification: 1, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 5.3317755638575175},
      {amplification: 3, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 6.896221833652769},
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 7.627913133644028},
      {amplification: 10, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 8.460442066577425},
      {amplification: 20, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.039770474570926},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.338579672892703},
      {amplification: 55, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.497192647761961},
      {amplification: 80, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.588189486283492},
      {amplification: 100, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.629239320211923},
      // swap big percentage of tokens (this is going to make more balance in the pool)
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 7.627913133644028},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 8.830230789508375},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.338579672892703},
      {amplification: 65, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.541599111062181},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 1, swapAmountOut: 9.620544606819651},
    ];
    for (let i:number = 0; i < swapsTests.length; ++i) {
      await checkSwap(owner, swapsTests[i], true, true);
    }
  });

  it("tests various swaps yield in", async () => {
    const swapsTests:SwapTestRun[] = [
      // basic swap with exchange rate aligned to balances with increasing amplification
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.9784018372524833},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.9794000668498882},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.979733270625232},
      {amplification: 65, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.9798544929018749},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.9798999591380052},
      
      // exchange rate doesn't match balances with increasing amplification
      {amplification: 1, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.3562540744512224},
      {amplification: 3, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.6103952416463594},
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.7127786624515455},
      {amplification: 15, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.8592914652303911},
      {amplification: 25, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.8967255491721766},
      {amplification: 45, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.9237011908949793},
      {amplification: 70, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.9363193351638321},
      {amplification: 95, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.9424276065986663},
      
      // exchange rate doesn't match balances (different direction) with increasing amplification
      {amplification: 1, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.7872015561660912},
      {amplification: 3, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.3849666433163224},
      {amplification: 5, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.2536077337113882},
      {amplification: 10, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.131957093158697},
      {amplification: 20, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.0606443666723824},
      {amplification: 35, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.027359882510765},
      {amplification: 55, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.010553660402521},
      {amplification: 80, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 1.0011662485931432},
      {amplification: 100, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 10, swapAmountOut: 0.996990344244073}
    ];
    for (let i:number = 0; i < swapsTests.length; ++i) {
      await checkSwap(owner, swapsTests[i], false, true);
    }
  });
  it("test swaps principal in with given out", async () => {
    const swapsTests:SwapTestRun[] = [
      {amplification: 50, pricePerPrincipal: 1, pricePerYield: 0.1, balancePrincipal: 100, balanceYield: 1000, swapAmountIn: 1.0206083017805911, swapAmountOut: 10},
      {amplification: 1, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 2.51919708866144, swapAmountOut: 10},
      {amplification: 1, pricePerPrincipal: 1, pricePerYield: 0.3, balancePrincipal: 200, balanceYield: 1000, swapAmountIn: 2.506296565358819, swapAmountOut: 10},
      {amplification: 60, pricePerPrincipal: 1, pricePerYield: 0.2, balancePrincipal: 300, balanceYield: 1000, swapAmountIn: 2.0556959982617378, swapAmountOut: 10},
      {amplification: 60, pricePerPrincipal: 1, pricePerYield: 0.3, balancePrincipal: 200, balanceYield: 1000, swapAmountIn: 3.040314590456069, swapAmountOut: 10}
    ];
    for (let i:number = 0; i < swapsTests.length; ++i) {
      await checkSwap(owner, swapsTests[i], true, false);
    }
  });
});
