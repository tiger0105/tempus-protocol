import { PoolTestFixture, TempusAMMParams } from "./PoolTestFixture";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { IERC20 } from "../utils/IERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { YearnVault } from "../utils/YearnVault";
import { NumberOrString } from "test/utils/Decimal";
import { TokenInfo } from "./TokenInfo";

export class YearnTestPool extends PoolTestFixture {
  yearn:YearnVault;
  ASSET_TOKEN:TokenInfo;
  YIELD_TOKEN:TokenInfo;
  constructor(ASSET_TOKEN:TokenInfo, YIELD_TOKEN:TokenInfo) {
    super(PoolType.Yearn, /*yieldPeggedToAsset:*/false);
    this.ASSET_TOKEN = ASSET_TOKEN;
    this.YIELD_TOKEN = YIELD_TOKEN;
  }
  public pool(): ContractBase {
    return this.yearn;
  }
  public asset(): IERC20 {
    return this.yearn.asset;
  }
  public yieldToken(): ERC20 {
    return this.yearn.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.yearn.yieldToken.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    return this.yearn.setPricePerShare(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.yearn.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.yearn.deposit(user, amount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, this.YIELD_TOKEN.name, this.YIELD_TOKEN.symbol, async () => {
      return await YearnVault.create(this.ASSET_TOKEN, this.YIELD_TOKEN, this.initialRate);
    }, (pool:ContractBase) => {
      this.yearn = <YearnVault>pool;
    });
  }
}
