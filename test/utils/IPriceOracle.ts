import { Contract } from "ethers";
import { ContractBase } from "./ContractBase";

export class IPriceOracle extends ContractBase {
  constructor(oracle:Contract, oracleName:string) {
    super(oracleName, 18, oracle);
  }
  static async deploy(oracleName:string): Promise<IPriceOracle> {
    const oracle = await ContractBase.deployContract(oracleName);
    return new IPriceOracle(oracle, oracleName);
  }
}
