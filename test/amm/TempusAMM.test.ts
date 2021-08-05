import { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { ContractBase } from "./../utils/ContractBase";
import { BigNumber, Contract } from "ethers";
import { fromWei, toWei } from "./../utils/Decimal";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { MockProvider } from "@ethereum-waffle/provider";
import { deployMockContract } from "@ethereum-waffle/mock-contract";


const WETH_ARTIFACTS = require("../../artifacts/@balancer-labs/v2-solidity-utils/contracts/misc/IWETH.sol/IWETH");

export const SECOND = 1;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const MONTH = DAY * 30;

async function deployTempusAMM(admin: SignerWithAddress, principalShareAddress: string, yieldShareAddress: string) {
  const AMPLIFICATION_PARAMETER = 5;
  const SWAP_FEE = 2e15; // (0.2%)
  const tokens = [principalShareAddress, yieldShareAddress].sort(); // Balancer's BasePool requires the arrays to be sorted
  
  const [sender] = new MockProvider().getWallets();
  const mockedWETH = await deployMockContract(sender, WETH_ARTIFACTS.abi);

  const authorizer = await ContractBase.deployContract("Authorizer", admin.address);
  const vault = await ContractBase.deployContract("Vault", authorizer.address, mockedWETH.address, 3 * MONTH, MONTH);

  const tempusAMM = await ContractBase.deployContract("TempusAMM", vault.address, "Tem", "LP", tokens, AMPLIFICATION_PARAMETER, SWAP_FEE, 3 * MONTH, MONTH, admin.address);
  return { tempusAMM, vault };
}

const setup = deployments.createFixture(async () => {
    await deployments.fixture(undefined, {
      keepExistingDeployments: true, // global option to test network like that
    });

    const [owner, user] = await ethers.getSigners();

    const principalShare = await ContractBase.deployContract("TempusShareMock", "Tempus Principal", "TPS");
    const yieldShare = await ContractBase.deployContract("TempusShareMock", "Tempus Yield", "TYS");
    
    await principalShare.connect(owner).mint(owner.address, toWei(100000));
    await yieldShare.connect(owner).mint(owner.address, toWei(100000));
    
    await principalShare.connect(owner).setPricePerFullShare(toWei(1));
    await yieldShare.connect(owner).setPricePerFullShare(toWei(0.1));

    const { tempusAMM, vault } = await deployTempusAMM(owner, principalShare.address, yieldShare.address);
    await principalShare.connect(owner).approve(vault.address, toWei(100000));
    await yieldShare.connect(owner).approve(vault.address, toWei(100000));
    
    await provideInitialLiquidity(vault, tempusAMM, owner, principalShare, yieldShare);
    
    return {
      contracts: {
        principalShare,
        yieldShare,
        tempusAMM,
        vault
      },
      signers: {
        owner,
        user
      }
    };
  });
  
async function provideInitialLiquidity(vault: Contract, pool: Contract, from: SignerWithAddress, principalShare: Contract, yieldShare: Contract) {
  const JOIN_KIND_INIT = 0;
  const poolId = await pool.getPoolId();
  const assets = [
    { address: principalShare.address, amount: toWei(10000) },
    { address: yieldShare.address, amount: toWei(100000) }
  ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));
  
  const initialBalances = assets.map(({ amount }) => amount);
  const initUserData = ethers.utils.defaultAbiCoder.encode(
    ['uint256', 'uint256[]'], [JOIN_KIND_INIT, initialBalances]
  );
  const joinPoolRequest = {
    assets: assets.map(({ address }) => address),
    maxAmountsIn: initialBalances,
    userData: initUserData,
    fromInternalBalance: false
  };

  await vault.connect(from).joinPool(poolId, from.address, from.address, joinPoolRequest);
}

async function swapGivenIn(vault: Contract, pool: Contract, from: SignerWithAddress, assetIn: string, assetOut: string, amount: BigNumber) {
  const SWAP_KIND_GIVEN_IN = 0;
  const poolId = await pool.getPoolId();
  
  const singleSwap = {
    poolId,
    kind: SWAP_KIND_GIVEN_IN,
    assetIn: assetIn,
    assetOut: assetOut,
    amount: amount,
    userData: 0x0
  };

  const fundManagement = {
    sender: from.address,
    fromInternalBalance: false,
    recipient: from.address,
    toInternalBalance: false
};
  const minimumReturn = 1;
  const deadline = Math.floor(new Date().getTime() / 1000) * 2; // current_unix_timestamp * 2
  await vault.connect(from).swap(singleSwap, fundManagement, minimumReturn, deadline);
}


describe("TempusPool", async () => {

    it("checks LP's pool token balance is greater than 0", async () =>
    {
        const { contracts: { principalShare, yieldShare, tempusAMM, vault }, signers } = await setup();
        
        const poolTokensBalance = await tempusAMM.balanceOf(signers.owner.address);
        expect(fromWei(poolTokensBalance)).to.be.greaterThan(0);
      });

    it("tests basic swap", async () => {
      const { contracts: { principalShare, yieldShare, tempusAMM, vault }, signers } = await setup();
      const amount = toWei(0.01);
      const fee = toWei(0.00002);
      const actualAmountIn = amount.sub(fee);
      const expectedAmountOutMin = actualAmountIn.mul(99).div(10);
      const expectedAmountOutMax = actualAmountIn.mul(10);
      
      const preSwapTPSBalance: BigNumber = await principalShare.balanceOf(signers.owner.address);
      const preSwapTYSBalance: BigNumber = await yieldShare.balanceOf(signers.owner.address);
      
      await swapGivenIn(vault, tempusAMM, signers.owner, principalShare.address, yieldShare.address, amount) // should return 10 TYS
      
      const postSwapTPSBalance: BigNumber = await principalShare.balanceOf(signers.owner.address);
      const postSwapTYSBalance: BigNumber = await yieldShare.balanceOf(signers.owner.address);
      
      expect(preSwapTPSBalance.sub(postSwapTPSBalance).toString()).to.equal(amount.toString());
      const swapAmountOut = postSwapTYSBalance.sub(preSwapTYSBalance);
      if (swapAmountOut.gt(expectedAmountOutMax) || swapAmountOut.lt(expectedAmountOutMin)) {
        expect(true).to.equal(false);
      }
    });

    it("tests basic swap if balances are not aligned with exchange rate", async () => {
      const { contracts: { principalShare, yieldShare, tempusAMM, vault }, signers } = await setup();
      await principalShare.connect(signers.owner).setPricePerFullShare(toWei(1));
      await yieldShare.connect(signers.owner).setPricePerFullShare(toWei(0.2));
      const amount = toWei(0.01);
      const fee = toWei(0.00002);
      const actualAmountIn = amount.sub(fee);
      const expectedAmountOutMin = actualAmountIn.mul(570).div(100);
      const expectedAmountOutMax = actualAmountIn.mul(571).div(100);
      
      const preSwapTPSBalance: BigNumber = await principalShare.balanceOf(signers.owner.address);
      const preSwapTYSBalance: BigNumber = await yieldShare.balanceOf(signers.owner.address);
      
      await swapGivenIn(vault, tempusAMM, signers.owner, principalShare.address, yieldShare.address, amount) // should return 10 TYS
      
      const postSwapTPSBalance: BigNumber = await principalShare.balanceOf(signers.owner.address);
      const postSwapTYSBalance: BigNumber = await yieldShare.balanceOf(signers.owner.address);
      
      expect(preSwapTPSBalance.sub(postSwapTPSBalance).toString()).to.equal(amount.toString());
      const swapAmountOut = postSwapTYSBalance.sub(preSwapTYSBalance);
      if (swapAmountOut.gt(expectedAmountOutMax) || swapAmountOut.lt(expectedAmountOutMin)) {
        expect(true).to.equal(false);
      }
    });

});
