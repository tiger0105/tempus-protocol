import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Comptroller } from "../utils/Comptroller";
import { NumberOrString } from "test/utils/Decimal";

// Compound CErc20
export class CompoundTestPool extends ITestPool
{
  compound:Comptroller;
  constructor() {
    super(PoolType.Compound, 'TPS-cDAI', 'TYS-cDAI', /*yieldPeggedToAsset:*/false);
  }
  public asset(): ERC20 {
    return this.compound.asset;
  }
  async yieldTokenBalance(user:Signer): Promise<NumberOrString> {
    return this.compound.yieldToken.balanceOf(user);
  }
  async createTempusPool(initialRate:number, poolDurationSeconds:number): Promise<TempusPool> {
    this.compound = await Comptroller.create('CErc20', 1000000);
    await this.compound.setExchangeRate(initialRate);

    this.maturityTime = await blockTimestamp() + poolDurationSeconds;
    const names = {
      principalName: this.principalName,
      principalSymbol: this.principalName,
      yieldName: this.yieldName, 
      yieldSymbol: this.yieldName
    };
    this.tempus = await TempusPool.deploy(this.compound.yieldToken, this.compound.priceOracle, this.maturityTime, names);
    return this.tempus;
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.compound.setExchangeRate(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.compound.enterMarkets(user);
    await this.compound.mint(user, amount);
  }
}
