import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Lido } from "../utils/Lido";

export class LidoTestPool extends ITestPool
{
  lido:Lido;
  constructor() {
    super(PoolType.Lido, 'TPS-stETH', 'TYS-stETH');
  }
  public asset(): ERC20 {
    return this.lido.asset;
  }
  async createTempusPool(owner:Signer, user:Signer): Promise<TempusPool> {
    this.lido = await Lido.create(1000000);
    await this.lido.asset.transfer(owner, user, 10000); // initial deposit for User

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    return await TempusPool.deploy(this.lido.yieldToken, this.lido.priceOracle, this.maturityTime);
  }
  async setExchangeRate(rate:number): Promise<void> {
    // TODO: No exchange rate control in Lido yet
    return;
  }
  async deposit(owner:Signer, users:Signer[], depositToUsers:number): Promise<void> {
    const totalDeposit = depositToUsers*(users.length+1);
    await this.lido.submit(owner, totalDeposit);
    for (let user of users) {
      await this.lido.yieldToken.transfer(owner, user, depositToUsers);
    }
  }
}
