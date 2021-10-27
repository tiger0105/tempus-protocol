import { Transaction } from "ethers";
import { PoolTestFixture, TempusAMMParams } from "./PoolTestFixture";
import { TokenInfo } from "./TokenInfo";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { ERC20 } from "../utils/ERC20";
import { IERC20 } from "../utils/IERC20";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { Lido } from "../utils/Lido";
import { NumberOrString } from "../utils/Decimal";

export class LidoTestPool extends PoolTestFixture {
  lido:Lido;
  ASSET_TOKEN:TokenInfo;
  YIELD_TOKEN:TokenInfo;
  constructor(ASSET_TOKEN:TokenInfo, YIELD_TOKEN:TokenInfo) {
    super(PoolType.Lido, /*yieldPeggedToAsset:*/true);
    this.ASSET_TOKEN = ASSET_TOKEN;
    this.YIELD_TOKEN = YIELD_TOKEN;
  }
  public pool(): ContractBase {
    return this.lido;
  }
  public asset(): IERC20 {
    return this.lido.asset;
  }
  public yieldToken(): ERC20 {
    return this.lido.yieldToken;
  }
  async yieldTokenBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return this.lido.yieldToken.balanceOf(user);
  }
  async backingTokenBalance(user:Signer): Promise<NumberOrString> {
    return this.lido.asset.balanceOf(user);
  }
  async setInterestRate(rate:number): Promise<void> {
    await this.lido.setInterestRate(rate);
  }
  async forceFailNextDepositOrRedeem(): Promise<void> {
    await this.lido.contract.setFailNextDepositOrRedeem(true);
  }
  async deposit(user:Signer, amount:number): Promise<void> {
    await this.lido.submit(user, amount);
  }
  async depositBT(user:Signer, backingTokenAmount:number, recipient:Signer = user): Promise<Transaction> {
    // sends ETH value with tx
    return this.tempus.controller.depositBacking(user, this.tempus, backingTokenAmount, recipient, backingTokenAmount);
  }

  async createWithAMM(params:TempusAMMParams): Promise<TempusPool> {
    return await this.initPool(params, this.YIELD_TOKEN.name, this.YIELD_TOKEN.symbol, async () => {
      return await Lido.create(this.ASSET_TOKEN, this.YIELD_TOKEN, this.initialRate);
    }, (pool:ContractBase) => {
      this.lido = <Lido>pool;
    });
  }
}
