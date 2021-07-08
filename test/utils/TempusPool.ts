import { BigNumber, Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IAssetPool } from "./IAssetPool";

/**
 * Wrapper around TempusPool
 */
export class TempusPool extends ContractBase {
  assetPool:IAssetPool;
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken
  principalShare:ERC20;
  yieldShare:ERC20;

  constructor(pool:Contract, assetPool:IAssetPool, principalShare:ERC20, yieldShare:ERC20) {
    super("TempusPool", 18, pool);
    this.assetPool = assetPool;
    this.yieldBearing = assetPool.yieldBearing;
    this.principalShare = principalShare;
    this.yieldShare = yieldShare;
    if (this.yieldBearing.decimals != this.decimals) {
      throw new Error("TempusPool decimals must equal backing asset decimals");
    }
  }

  /**
   * Deploys TempusPool
   * @param assetPool Asset pool which manages the Yield Bearing Token
   * @param startTime Starting time of the pool
   * @param maturityTime Maturity time of the pool
   */
  static async deploy(assetPool:IAssetPool, maturityTime:number): Promise<TempusPool> {
    const pool = await ContractBase.deployContract("TempusPool", assetPool.address(), maturityTime);
    const principalShare = await ERC20.attach("PrincipalShare", await pool.principalShare());
    const yieldShare = await ERC20.attach("YieldShare", await pool.yieldShare());
    return new TempusPool(pool, assetPool, principalShare, yieldShare);
  }

  /**
   * Deposits backing asset tokens into Tempus Pool on behalf of user
   * @param user User who is depositing
   * @param assetAmount How much to deposit
   */
  async deposit(user:SignerOrAddress, assetAmount:NumberOrString) {
    try {
      await this.yieldBearing.approve(user, this.contract.address, assetAmount);
      await this.contract.connect(user).deposit(addressOf(user), this.toBigNum(assetAmount));
    } catch(e) {
      throw new Error("TempusPool.deposit failed: " + e.message);
    }
  }

  /**
   * @returns The version of the pool
   */
  async version(): Promise<NumberOrString> {
    return await this.contract.version();
  }

  /**
   * @returns The start time of the pool
   */
  async startTime(): Promise<NumberOrString> {
    let start:BigNumber = await this.contract.startTime();
    return start.toNumber();
  }

  /**
   * @returns The maturity time of the pool
   */
  async maturityTime(): Promise<NumberOrString> {
    let maturity:BigNumber = await this.contract.maturityTime();
    return maturity.toNumber();
  }

  /**
   * @returns Initial exchange rate when the pool started
   */
  async initialExchangeRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.initialExchangeRate());
  }
  
  /**
   * @returns Current exchange rate of the pool
   */
  async currentExchangeRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.currentExchangeRate());
  }
}
