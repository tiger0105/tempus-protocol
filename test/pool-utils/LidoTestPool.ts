import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Lido } from "../utils/Lido";
import { NumberOrString } from "../utils/Decimal";

export class LidoTestPool extends ITestPool
{
  lido:Lido;
  constructor() {
    super(PoolType.Lido, 'TPS-stETH', 'TYS-stETH', /*yieldPeggedToAsset:*/true);
  }
  public asset(): ERC20 {
    return this.lido.asset;
  }
  async yieldTokenBalance(user:Signer): Promise<NumberOrString> {
    return this.lido.balanceOf(user);
  }
  async createTempusPool(initialRate:number): Promise<TempusPool> {
    this.lido = await Lido.create(1000000);
    await this.setExchangeRate(initialRate);

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    const names = {
      principalName: this.principalName,
      principalSymbol: this.principalName,
      yieldName: this.yieldName, 
      yieldSymbol: this.yieldName
    };
    this.tempus = await TempusPool.deploy(this.lido.yieldToken, this.lido.priceOracle, this.maturityTime, names);
    return this.tempus;
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.lido.setExchangeRate(rate);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.lido.submit(user, amount);
  }
}
