import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Aave } from "../utils/Aave";
import { NumberOrString } from "test/utils/Decimal";

export class AaveTestPool extends ITestPool
{
  aave:Aave;
  constructor() {
    super(PoolType.Aave, 'TPS-AAT', 'TYS-AAT', /*yieldPeggedToAsset:*/true);
  }
  public asset(): ERC20 {
    return this.aave.asset;
  }
  async yieldTokenBalance(user:Signer): Promise<NumberOrString> {
    return this.aave.yieldToken.balanceOf(user);
  }
  async createTempusPool(initialRate:number): Promise<TempusPool> {
    this.aave = await Aave.create(1000000);
    await this.aave.setLiquidityIndex(initialRate);

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    this.tempus = await TempusPool.deploy(this.aave.yieldToken, this.aave.priceOracle, this.maturityTime);
    return this.tempus;
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.aave.setLiquidityIndex(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.aave.deposit(user, amount);
  }
}
