import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IPriceOracle } from "./IPriceOracle";
import { PoolShare } from "./PoolShare";

/**
 * Wrapper around TempusPool
 */
export class TempusPool extends ContractBase {
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken
  principalShare:PoolShare;
  yieldShare:PoolShare;
  priceOracle:IPriceOracle;

  constructor(pool:Contract, yieldBearing:ERC20, principalShare:PoolShare, yieldShare:PoolShare, priceOracle:IPriceOracle) {
    super("TempusPool", 18, pool);
    this.yieldBearing = yieldBearing;
    this.principalShare = principalShare;
    this.yieldShare = yieldShare;
    this.priceOracle = priceOracle;
    if (this.yieldBearing.decimals != this.decimals) {
      throw new Error("TempusPool decimals must equal backing asset decimals");
    }
  }

  /**
   * Deploys TempusPool
   * @param yieldToken The yield bearing token, such as aave.earn (AToken)
   * @param priceOracle Price oracle name which returns the current exchange rate from yieldTokens, such as AavePriceOracle
   * @param startTime Starting time of the pool
   * @param maturityTime Maturity time of the pool
   */
  static async deploy(yieldToken:ERC20, priceOracle:IPriceOracle, maturityTime:number): Promise<TempusPool> {
    const pool = await ContractBase.deployContract("TempusPool", yieldToken.address, priceOracle.address, maturityTime);
    const principalShare = await PoolShare.attach("principal", await pool.principalShare());
    const yieldShare = await PoolShare.attach("yield", await pool.yieldShare());
    return new TempusPool(pool, yieldToken, principalShare, yieldShare, priceOracle);
  }

  /**
   * Deposits backing asset tokens into Tempus Pool on behalf of user
   * @param user User who is depositing
   * @param assetAmount How much to deposit
   * @param recipient Address or User who will receive the minted shares
   */
  async deposit(user:SignerOrAddress, assetAmount:NumberOrString, recipient:SignerOrAddress) {
    try {
      await this.yieldBearing.approve(user, this.contract.address, assetAmount);
      await this.connect(user).deposit(this.toBigNum(assetAmount), addressOf(recipient));
      // NOTE: we can't easily test the return value of a transaction, so it's omitted
    } catch(e) {
      throw new Error("TempusPool.deposit failed: " + e.message);
    }
  }

  /**
   * Reedem shares from the Tempus Pool
   * @param user User who is depositing
   * @param principalAmount How many principal shares to redeem
   * @param yieldAmount How many yield shares to redeem
   */
  async redeem(user:SignerOrAddress, principalAmount:NumberOrString, yieldAmount:NumberOrString) {
    try {
      await this.contract.connect(user).redeem(this.toBigNum(principalAmount), this.toBigNum(yieldAmount));
    } catch(e) {
      throw new Error("TempusPool.redeem failed: " + e.message);
    }
  }

  /**
   * Finalize the pool after maturity
   */
  async finalize() {
    await this.contract.finalize();
  }

  /**
   * @returns True if maturity has been reached and the pool was finalized.
   */
  async matured() {
    return this.contract.matured();
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

  /**
   * @returns Exchange rate at maturity of the pool
   */
  async maturityExchangeRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.maturityExchangeRate());
  }
}

export async function expectUserState(pool:TempusPool, owner:SignerOrAddress, principalShares:number, yieldShares:number, yieldBearing:number) {
  expect(await pool.principalShare.balanceOf(owner)).to.equal(principalShares);
  expect(await pool.yieldShare.balanceOf(owner)).to.equal(yieldShares);
  expect(await pool.yieldBearing.balanceOf(owner)).to.equal(yieldBearing);
}
