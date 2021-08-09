import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Comptroller } from "../utils/Comptroller";

// Compound CErc20
export class CompoundTestPool extends ITestPool
{
  compound:Comptroller;
  constructor() {
    super(PoolType.Compound, 'TPS-cDAI', 'TYS-cDAI', /*mintScalesWithRate:*/true);
  }
  public asset(): ERC20 {
    return this.compound.asset;
  }
  async createTempusPool(initialRate:number): Promise<TempusPool> {
    this.compound = await Comptroller.create('CErc20', 1000000);
    await this.compound.setExchangeRate(initialRate);

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    this.pool =  await TempusPool.deploy(this.compound.yieldToken, this.compound.priceOracle, this.maturityTime);
    return this.pool;
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.compound.setExchangeRate(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.compound.enterMarkets(user);
    await this.compound.mint(user, amount);
  }
}
