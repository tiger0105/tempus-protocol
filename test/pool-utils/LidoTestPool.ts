import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Lido } from "../utils/Lido";
import { fromWei } from "../utils/Decimal";

export class LidoTestPool extends ITestPool
{
  lido:Lido;
  constructor() {
    super(PoolType.Lido, 'TPS-stETH', 'TYS-stETH', /*mintScalesWithRate:*/false);
  }
  public asset(): ERC20 {
    return this.lido.asset;
  }
  async createTempusPool(initialRate:number): Promise<TempusPool> {
    this.lido = await Lido.create(1000000);
    await this.setExchangeRate(initialRate);

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    this.pool = await TempusPool.deploy(this.lido.yieldToken, this.lido.priceOracle, this.maturityTime);
    return this.pool;
  }
  async setExchangeRate(rate:number): Promise<void> {
    //this.lido.setExchangeRate(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.lido.submit(user, amount);
  }
}
