import { ITestPool, TempusAMMParams } from "./ITestPool";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { Comptroller } from "../utils/Comptroller";
import { NumberOrString } from "test/utils/Decimal";

// Compound CErc20
export class CompoundTestPool extends ITestPool {
  compound:Comptroller;
  constructor() {
    super(PoolType.Compound, /*yieldPeggedToAsset:*/false);
  }
  public pool(): ContractBase {
    return this.compound;
  }
  public asset(): ERC20 {
    return this.compound.asset;
  }
  public yieldToken(): ERC20 {
    return this.compound.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.compound.yieldToken.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    await this.compound.setExchangeRate(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.compound.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.compound.enterMarkets(user);
    await this.compound.mint(user, amount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, 'TPS-cDAI', 'TYS-cDAI', async () => {
      return await Comptroller.create(1000000, this.initialRate);
    }, (pool:ContractBase) => {
      this.compound = <Comptroller>pool;
    });
  }
}
