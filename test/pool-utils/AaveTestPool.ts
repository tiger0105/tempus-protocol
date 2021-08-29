import { ITestPool, TempusAMMParams } from "./ITestPool";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { Aave } from "../utils/Aave";
import { NumberOrString } from "test/utils/Decimal";

export class AaveTestPool extends ITestPool {
  aave:Aave;
  constructor() {
    super(PoolType.Aave, /*yieldPeggedToAsset:*/true);
  }
  public pool(): ContractBase {
    return this.aave;
  }
  public asset(): ERC20 {
    return this.aave.asset;
  }
  public yieldToken(): ERC20 {
    return this.aave.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.aave.yieldToken.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    await this.aave.setLiquidityIndex(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.aave.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.aave.deposit(user, amount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, 'TPS-AAT', 'TYS-AAT', async () => {
      return await Aave.create(10000000000, this.initialRate);
    }, (pool:ContractBase) => {
      this.aave = <Aave>pool;
    });
  }
}
