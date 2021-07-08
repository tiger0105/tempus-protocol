import { Contract } from "ethers";
import { ERC20 } from "./ERC20";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";

export class IAssetPool extends ContractBase {
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken

  constructor(name:string, pool:Contract, yieldBearing:ERC20) {
    super(name, 18, pool);
    this.yieldBearing = yieldBearing;
  }

  /**
   * Deploys a new AssetPool by name
   * @param assetPoolName Name of the asset pool
   * @param yieldBearing The Yield Bearing Token contract instance
   */
  static async deploy(assetPoolName:string, yieldBearing:ERC20): Promise<IAssetPool> {
    const pool = await ContractBase.deployContract(assetPoolName, yieldBearing.address());
    return new IAssetPool(assetPoolName, pool, yieldBearing);
  }

  /**
   * Deposits X amount of backing tokens from sender into the underlying pool
   * @param onBehalfOf ERC20 Address which will receive the Yield Bearing Tokens
   * @param amount Amount of backing tokens, such as ETH or DAI to deposit
   */
  async depositAsset(onBehalfOf:SignerOrAddress, amount:NumberOrString): Promise<void> {
    await this.contract.depositAsset(addressOf(onBehalfOf), this.toBigNum(amount));
  }
  
  /**
   * @param token An ERC20 token which belongs to a POOL
   * @returns Current exchange rate of that Token in the pool
   */
  async currentRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.currentRate());
  }
}
