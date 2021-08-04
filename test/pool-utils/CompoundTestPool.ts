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
    super(PoolType.Compound, 'TPS-cDAI', 'TYS-cDAI');
  }
  public asset(): ERC20 {
    return this.compound.asset;
  }
  async createTempusPool(owner:Signer, user:Signer): Promise<TempusPool> {
    this.compound = await Comptroller.create('CErc20', 1000000);
    await this.compound.asset.transfer(owner, user, 10000); // initial deposit for User

    this.maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
    return await TempusPool.deploy(this.compound.yieldToken, this.compound.priceOracle, this.maturityTime);
  }
  async setExchangeRate(rate:number): Promise<void> {
    await this.compound.setExchangeRate(rate);
  }
  async deposit(owner:Signer, users:Signer[], depositToUsers:number): Promise<void> {
    const totalDeposit = depositToUsers*(users.length+1);
    await this.compound.enterMarkets(owner);
    await this.compound.mint(owner, totalDeposit);
    for (let user of users) {
      await this.compound.yieldToken.transfer(owner, user, depositToUsers);
    }
  }
}
