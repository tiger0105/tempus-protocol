import { PoolTestFixture, TempusAMMParams } from "./PoolTestFixture";
import { ContractBase, Signer, SignerOrAddress } from "../utils/ContractBase";
import { TempusPool, PoolType } from "../utils/TempusPool";
import { TokenInfo } from "./TokenInfo";
import { Lido } from "../utils/Lido";
import { Transaction } from "ethers";

export class LidoTestPool extends PoolTestFixture {
  lido:Lido;
  ASSET_TOKEN:TokenInfo;
  YIELD_TOKEN:TokenInfo;
  constructor(ASSET_TOKEN:TokenInfo, YIELD_TOKEN:TokenInfo) {
    super(PoolType.Lido, /*yieldPeggedToAsset:*/true);
    this.ASSET_TOKEN = ASSET_TOKEN;
    this.YIELD_TOKEN = YIELD_TOKEN;
  }
  public setInterestRate(rate:number): Promise<void> {
    return this.lido.setInterestRate(rate);
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
      this.asset = this.lido.asset;
      this.ybt = this.lido.yieldToken;
    });
  }
}
