import { Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase } from "./ContractBase";
import { ITestPool } from "../pool-utils/ITestPool";

export class Stats extends ContractBase {
  constructor(contract:Contract) {
    super("Stats", 18, contract);
  }

  static async create(): Promise<Stats> {
    return new Stats(await ContractBase.deployContract("Stats"));
  }

  /**
   * @param amount Amount of BackingTokens or YieldBearingTokens that would be deposited
   * @param isBackingToken If true, @param amount is in BackingTokens, otherwise YieldBearingTokens
   * @return Amount of Principals (TPS) and Yields (TYS), scaled as 1e18 decimals.
   *         TPS and TYS are minted in 1:1 ratio, hence a single return value
   */
  async estimatedMintedShares(pool:ITestPool, amount:NumberOrString, isBackingToken:boolean): Promise<NumberOrString> {
    const t = pool.tempus;
    return t.fromBigNum(await this.contract.estimatedMintedShares(t.address, t.toBigNum(amount), isBackingToken));
  }

  /**
   * @param principals Amount of Principals (TPS)
   * @param yields Amount of Yields (TYS)
   * @param toBackingToken If true, redeem amount is estimated in BackingTokens instead of YieldBearingTokens
   * @return YBT or BT amount
   */
  async estimatedRedeem(pool:ITestPool, principals:NumberOrString, yields:NumberOrString, toBackingToken:boolean): Promise<NumberOrString> {
    const t = pool.tempus;
    return t.fromBigNum(await this.contract.estimatedRedeem(t.address, t.toBigNum(principals), t.toBigNum(yields), toBackingToken));
  }
}
