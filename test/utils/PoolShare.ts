import { Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { SignerOrAddress, addressOf, ContractBase } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { ERC20OwnerMintable } from "./ERC20OwnerMintable";
import { TempusPool } from "./TempusPool";

export class PoolShare extends ERC20OwnerMintable {
  constructor(contractName:string, contract:Contract) {
    super(contractName, contract);
  }

  /**
   * @param kind "yield" or "principal"
   */
  static async attach(kind:string, address:string): Promise<PoolShare> {
    const isYield = (kind == "yield");
    const contractName = isYield ? "YieldShare" : "PrincipalShare";
    const contract = await ContractBase.attachContract(contractName, address);
    return new PoolShare(contractName, contract);
  }

  /**
   * @returns Price per share as described in PoolShare.sol
   */
  async pricePerShare(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.pricePerShare());
  }
}
