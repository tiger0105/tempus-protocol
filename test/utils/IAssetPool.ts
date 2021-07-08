import { Contract } from "ethers";
import { ERC20 } from "./ERC20";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";

export class IAssetPool extends ContractBase {
  asset:ERC20; // actual asset token such as DAI or ETH
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken

  constructor(name:string, assetPool:Contract, asset:ERC20, yieldBearing:ERC20) {
    super(name, 18, assetPool);
    this.asset = asset;
    this.yieldBearing = yieldBearing;
  }

  /**
   * Deploys a new AssetPool by name
   * @param assetPoolName Name of the asset pool
   * @param asset Asset token contract instance
   * @param yieldBearing The Yield Bearing Token contract instance
   * @param yieldPool The pool which handles Yield Bearing Token transfers
   */
  static async deploy(assetPoolName:string, asset:ERC20, yieldBearing:ERC20, yieldPool:Contract): Promise<IAssetPool> {
    const assetPool = await ContractBase.deployContract(assetPoolName, yieldBearing.address(), yieldPool.address);
    return new IAssetPool(assetPoolName, assetPool, asset, yieldBearing);
  }

  /**
   * @dev Can be used to approve() transfer for depositAsset()
   * @returns The address of the underlying asset pool
   */
  async pool(): Promise<string> {
    return await this.contract.pool();
  }

  /**
   * Deposits X amount of backing tokens from sender into the underlying pool
   * @param recipient ERC20 Address which will receive the Yield Bearing Tokens
   * @param amount Amount of backing tokens, such as ETH or DAI to deposit
   * @return Number of Yield Bearing Tokens minted to `recipient`
   */
  async depositAsset(recipient:SignerOrAddress, amount:NumberOrString): Promise<NumberOrString> {
    const yieldAmount = await this.contract.depositAsset(addressOf(recipient), this.toBigNum(amount));
    return this.fromBigNum(yieldAmount);
  }
  
  /**
   * @param token An ERC20 token which belongs to a POOL
   * @returns Current exchange rate of that Token in the pool
   */
  async currentRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.currentRate());
  }
}
