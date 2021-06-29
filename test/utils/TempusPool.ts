import { Contract } from "ethers";
import { NumberOrString, fromRay } from "./Decimal";
import { ContractBase, SignerOrAddress } from "./ContractBase";
import { ERC20 } from "./ERC20";

/**
 * Wrapper around TempusPool
 */
export class TempusPool extends ContractBase {
  yieldBearing:ERC20; // actual yield bearing token such as AToken or CToken
  principal:ERC20; // principal share
  yield:ERC20; // yield share
  oracle:Contract; // price oracle

  constructor(pool:Contract, yieldBearing:ERC20, principal:ERC20, _yield:ERC20, oracle:Contract) {
    super("TempusPool", 18, pool);
    this.yieldBearing = yieldBearing;
    this.principal = principal;
    this.yield = _yield;
    this.oracle = oracle;
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
  static async deploy(yieldToken:ERC20, priceOracle:string, startTime:number, maturityTime:number): Promise<TempusPool> {
    const oracle = await ContractBase.deployContract(priceOracle);
    const pool = await ContractBase.deployContract("TempusPool", yieldToken.address(), oracle.address, startTime, maturityTime);
    const principalShare = await ERC20.attach("PrincipalShare", await pool.principalShare());
    const yieldShare = await ERC20.attach("YieldShare", await pool.yieldShare());
    return new TempusPool(pool, yieldToken, principalShare, yieldShare, oracle);
  }

  /**
   * Deposits backing asset tokens into Tempus Pool on behalf of user
   * @param user User who is depositing
   * @param assetAmount How much to deposit
   */
  async deposit(user:SignerOrAddress, assetAmount:NumberOrString) {
    try {
      await this.yieldBearing.approve(user, this.contract.address, assetAmount);
      await this.contract.connect(user).deposit(this.toBigNum(assetAmount));
    } catch(e) {
      throw new Error("TempusPool.deposit failed: " + e.message);
    }
  }

  /**
   * @returns Initial exchange rate when the pool started
   */
  async initialExchangeRate(): Promise<NumberOrString> {
    return fromRay(await this.contract.initialExchangeRate());
  }
  
  /**
   * @returns Current exchange rate of the pool
   */
  async currentExchangeRate(): Promise<NumberOrString> {
    return fromRay(await this.contract.currentExchangeRate());
  }
}
