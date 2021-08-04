import { ITestPool, PoolType } from "./ITestPool";
import { Signer } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool } from "../utils/TempusPool";
import { blockTimestamp } from "../utils/Utils";
import { Aave } from "../utils/Aave";

export class AaveTestPool extends ITestPool
{
  aave:Aave;
  constructor() {
    super(PoolType.Aave, 'TPS-AAT', 'TYS-AAT');
  }
  public asset(): ERC20 {
    return this.aave.asset;
  }
  async createTempusPool(owner:Signer, user:Signer): Promise<TempusPool> {
    this.aave = await Aave.create(1000000);
    await this.aave.asset.transfer(owner, user, 10000); // initial deposit for User

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    return await TempusPool.deploy(this.aave.yieldToken, this.aave.priceOracle, this.maturityTime);
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.aave.setLiquidityIndex(rate);
  }
  async deposit(owner:Signer, users:Signer[], depositToUsers:number): Promise<void> {
    const totalDeposit = depositToUsers*(users.length+1);
    await this.aave.deposit(owner, totalDeposit);
    for (let user of users) {
      await this.aave.yieldToken.transfer(owner, user, depositToUsers);
    }
  }
}
