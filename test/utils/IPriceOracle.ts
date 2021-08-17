import { BigNumber, Contract } from "ethers";
import { ERC20 } from "./ERC20";
import { NumberOrString } from "./Decimal";
import { ContractBase } from "./ContractBase";

export class IPriceOracle extends ContractBase {
  constructor(oracle:Contract, oracleName:string) {
    super(oracleName, 18, oracle);
  }
  static async deploy(oracleName:string): Promise<IPriceOracle> {
    const oracle = await ContractBase.deployContract(oracleName);
    return new IPriceOracle(oracle, oracleName);
  }
  
  /**
   * @param token An ERC20 token which belongs to a POOL
   * @returns Updated current Interest Rate as an 1e18 decimal
   */
  async updateInterestRate(token:ERC20|string): Promise<NumberOrString> {
    const address:string = (typeof(token) == 'string') ? token : token.address;
    await this.contract.updateInterestRate(address);
    return this.storedInterestRate(token);
  }
  
  /**
   * @param token An ERC20 token which belongs to a POOL
   * @returns Current stored Interest Rate of that Token in the pool
   */
  async storedInterestRate(token:ERC20|string): Promise<NumberOrString> {
    const address:string = (typeof(token) == 'string') ? token : token.address;
    return this.fromBigNum(await this.contract.storedInterestRate(address));
  }

  async numAssetsPerYieldToken(amount:NumberOrString, interestRate:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.numAssetsPerYieldToken(this.toBigNum(amount), this.toBigNum(interestRate)));
  }

  async numYieldTokensPerAsset(amount:NumberOrString, interestRate:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.numYieldTokensPerAsset(this.toBigNum(amount), this.toBigNum(interestRate)));
  }

}
