import { Transaction } from "ethers";
import { ethers } from "hardhat";
import { ITestPool, PoolType } from "./ITestPool";
import { Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp, getRevertMessage } from "../utils/Utils";
import { Lido } from "../utils/Lido";
import { fromWei, NumberOrString, toWei } from "../utils/Decimal";
import { expect } from "chai";

export class LidoTestPool extends ITestPool
{
  lido:Lido;
  constructor() {
    super(PoolType.Lido, 'TPS-stETH', 'TYS-stETH', /*yieldPeggedToAsset:*/true);
  }
  public asset(): ERC20 {
    return this.lido.asset;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.lido.balanceOf(user);
  }
  async backingTokenBalance(user:Signer): Promise<NumberOrString> {
    const ethBalance = await ethers.provider.getBalance(user.address);
    return fromWei(ethBalance);
  }
  async createTempusPool(initialRate:number, poolDurationSeconds:number): Promise<TempusPool> {
    this.lido = await Lido.create(1000000);
    await this.setInterestRate(initialRate);

    this.maturityTime = await blockTimestamp() + poolDurationSeconds;
    const names = {
      principalName: this.principalName,
      principalSymbol: this.principalName,
      yieldName: this.yieldName, 
      yieldSymbol: this.yieldName
    };
    const yieldEst = 0.1;
    this.tempus = await TempusPool.deployLido(this.lido.yieldToken, this.maturityTime, yieldEst, names);
    return this.tempus;
  }
  async setInterestRate(rate:number): Promise<void> {
    await this.lido.setInterestRate(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.lido.submit(user, amount);
  }
  async depositBT(user:Signer, backingTokenAmount:number, recipient:Signer = user): Promise<Transaction> {
    // sends ETH value with tx
    return this.tempus.depositBackingToken(user, backingTokenAmount, recipient, backingTokenAmount);
  }
  async expectDepositBT(user:Signer, backingTokenAmount:number, recipient:Signer = user): Promise<Chai.Assertion> {
    try {
      const preDepositBackingBalance = await this.backingTokenBalance(user);
      const tx = await this.depositBT(user, backingTokenAmount, recipient);
      const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
      
      const txEthGasFee = receipt.gasUsed.mul(tx.gasPrice);
      const postDepositBackingBalance = await this.backingTokenBalance(user);
      const backingBalanceDelta = fromWei(toWei(preDepositBackingBalance).sub(toWei(postDepositBackingBalance)).sub(txEthGasFee));
      expect(+backingBalanceDelta).to.equal(backingTokenAmount);
      
      return expect('success');
    } catch(e) {
      return expect(getRevertMessage(e));
    }
  }
}
