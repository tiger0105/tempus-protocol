import { ethers } from "hardhat";
import { BigNumber, Contract, Transaction } from "ethers";
import { NumberOrString, toWei, fromWei } from "./Decimal";
import { ContractBase } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { MockProvider } from "@ethereum-waffle/provider";
import { deployMockContract } from "@ethereum-waffle/mock-contract";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { blockTimestamp } from "./Utils";
import { TempusPool } from "./TempusPool";

const WETH_ARTIFACTS = require("../../artifacts/@balancer-labs/v2-solidity-utils/contracts/misc/IWETH.sol/IWETH");

export const SECOND = 1;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
export const MONTH = DAY * 30;

export enum TempusAMMExitKind {
  EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0,
  EXACT_BPT_IN_FOR_TOKENS_OUT,
  BPT_IN_FOR_EXACT_TOKENS_OUT,
}

export enum TempusAMMJoinKind {
  INIT = 0,  // first join to the pool, needs to pick token balances
  EXACT_TOKENS_IN_FOR_BPT_OUT,  // joining with exact amounts of both tokens
  EXACT_BPT_OUT_FOR_TOKEN_IN,  // joining with one token for exact amount of lp tokens out
}

export class TempusAMM extends ContractBase {
  vault: Contract;
  principalShare: ERC20;
  yieldShare: ERC20;
  tempusPool: TempusPool;

  constructor(tempusAmmPool: Contract, vault: Contract, tempusPool: TempusPool) {
    super("TempusAMM", 18, tempusAmmPool);
    this.vault = vault;
    this.tempusPool = tempusPool;
    this.principalShare = tempusPool.principalShare;
    this.yieldShare = tempusPool.yieldShare;
  }

  static async create(
    owner: SignerWithAddress,
    amplification: Number,
    swapFeePercentage: Number, 
    tempusPool: TempusPool
  ): Promise<TempusAMM> {
    const [sender] = new MockProvider().getWallets();
    const mockedWETH = await deployMockContract(sender, WETH_ARTIFACTS.abi);

    const authorizer = await ContractBase.deployContract("Authorizer", owner.address);
    const vault = await ContractBase.deployContract("Vault", authorizer.address, mockedWETH.address, 3 * MONTH, MONTH);

    let tempusAMM = await ContractBase.deployContract(
      "TempusAMM", 
      vault.address, 
      "Tempus LP token", 
      "LP", 
      tempusPool.address,
      amplification, 
      toWei(swapFeePercentage),
      3 * MONTH, 
      MONTH, 
      owner.address
    );

    return new TempusAMM(tempusAMM, vault, tempusPool);
  }

  async getLastInvariant(): Promise<{invariant: number, amplification: number}> {
    let inv:BigNumber;
    let amp: number;
    [inv, amp] = await this.contract.getLastInvariant();
    return {invariant: +fromWei(inv), amplification: amp};
  }

  async balanceOf(user:SignerWithAddress): Promise<NumberOrString> {
    return fromWei(await this.contract.balanceOf(user.address));
  }

  async getRate(): Promise<NumberOrString> {
    return fromWei(await this.contract.getRate());
  }

  async provideLiquidity(from: SignerWithAddress, principalShareBalance: Number, yieldShareBalance: Number, joinKind: TempusAMMJoinKind) {
    await this.principalShare.approve(from, this.vault.address, principalShareBalance);
    await this.yieldShare.approve(from, this.vault.address, yieldShareBalance);
    
    const poolId = await this.contract.getPoolId();
    const assets = [
      { address: this.principalShare.address, amount: toWei(principalShareBalance) },
      { address: this.yieldShare.address, amount: toWei(yieldShareBalance) }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));
    
    const initialBalances = assets.map(({ amount }) => amount);
    const initUserData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]'], [joinKind, initialBalances]
    );
    const joinPoolRequest = {
      assets: assets.map(({ address }) => address),
      maxAmountsIn: initialBalances,
      userData: initUserData,
      fromInternalBalance: false
    };
  
    await this.vault.connect(from).joinPool(poolId, from.address, from.address, joinPoolRequest);
  }

  async exitPoolExactLpAmountIn(from: SignerWithAddress, lpTokensAmount: Number, singleToken:boolean = false, singleTokenIndex:Number = 0) {
    const poolId = await this.contract.getPoolId();
    
    const assets = [
      { address: this.principalShare.address },
      { address: this.yieldShare.address }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));

    const exitUserData = ethers.utils.defaultAbiCoder.encode(
      singleToken ? ['uint256', 'uint256', 'uint256'] : ['uint256', 'uint256'], 
      singleToken ? 
        [TempusAMMExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, toWei(lpTokensAmount), singleTokenIndex] :
        [TempusAMMExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, toWei(lpTokensAmount)]
    );
    
    const exitPoolRequest = {
      assets: assets.map(({ address }) => address),
      minAmountsOut: [1000000, 100000],
      userData: exitUserData,
      toInternalBalance: false
    };
  
    await this.vault.connect(from).exitPool(poolId, from.address, from.address, exitPoolRequest);
  }

  async exitPoolExactAmountOut(from:SignerWithAddress, amountsOut:Number[], maxAmountLpIn:Number) {
    const poolId = await this.contract.getPoolId();
    
    const assets = [
      { address: this.principalShare.address, amountOut: toWei(amountsOut[0]) },
      { address: this.yieldShare.address, amountOut: toWei(amountsOut[1]) }
    ].sort(( asset1, asset2 ) => parseInt(asset1.address) - parseInt(asset2.address));

    const exitUserData = ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'uint256[]', 'uint256'], 
      [TempusAMMExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT, assets.map(({ amountOut }) => amountOut), toWei(maxAmountLpIn)],
    );
    
    const exitPoolRequest = {
      assets: assets.map(({ address }) => address),
      minAmountsOut: [1000000, 100000],
      userData: exitUserData,
      toInternalBalance: false
    };
  
    await this.vault.connect(from).exitPool(poolId, from.address, from.address, exitPoolRequest);
  }

  async swapGivenIn(from: SignerWithAddress, assetIn: string, assetOut: string, amount: Number) {
    this.yieldShare.connect(from).approve(this.vault.address, toWei(amount));
    this.principalShare.connect(from).approve(this.vault.address, toWei(amount));
    const SWAP_KIND_GIVEN_IN = 0;
    const poolId = await this.contract.getPoolId();
    
    const singleSwap = {
      poolId,
      kind: SWAP_KIND_GIVEN_IN,
      assetIn: assetIn,
      assetOut: assetOut,
      amount: toWei(amount),
      userData: 0x0
    };
  
    const fundManagement = {
      sender: from.address,
      fromInternalBalance: false,
      recipient: from.address,
      toInternalBalance: false
    };
    const minimumReturn = 1;
    const deadline = await blockTimestamp() + 60*60; // deadline in one hour
    await this.vault.connect(from).swap(singleSwap, fundManagement, minimumReturn, deadline);
  }

  async swapGivenOut(from: SignerWithAddress, assetIn: string, assetOut: string, amount: Number) {
    this.yieldShare.connect(from).approve(this.vault.address, toWei(amount));
    this.principalShare.connect(from).approve(this.vault.address, toWei(amount));
    
    const SWAP_KIND_GIVEN_OUT = 1;
    const poolId = await this.contract.getPoolId();
    
    const singleSwap = {
      poolId,
      kind: SWAP_KIND_GIVEN_OUT,
      assetIn: assetIn,
      assetOut: assetOut,
      amount: toWei(amount),
      userData: 0x0
    };
  
    const fundManagement = {
      sender: from.address,
      fromInternalBalance: false,
      recipient: from.address,
      toInternalBalance: false
    };
    const maximumIn = toWei(1000);
    const deadline = await blockTimestamp() + 60*60; // deadline in one hour
    await this.vault.connect(from).swap(singleSwap, fundManagement, maximumIn, deadline);
  }

  async startAmplificationUpdate(ampTarget: number, endTime: number): Promise<Transaction> {
    return this.contract.startAmplificationParameterUpdate(ampTarget, endTime);
  }

  async stopAmplificationUpdate(): Promise<Transaction> {
    return this.contract.stopAmplificationParameterUpdate();
  }

  async getAmplificationParam(): Promise<{value:NumberOrString, isUpdating:NumberOrString, precision:NumberOrString}> {
    return this.contract.getAmplificationParameter();
  }
}
