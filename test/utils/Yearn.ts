import { Contract } from "ethers";
import { NumberOrString, toWei, toRay, fromRay, fromWei } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IPriceOracle } from "./IPriceOracle";

export class Yearn extends ERC20 {
  asset:ERC20;
  yieldToken:ERC20;
  priceOracle:IPriceOracle;
  
  constructor(pool:Contract, asset:ERC20, priceOracle:IPriceOracle) {
    super("YearnVaultMock");
    this.contract = pool;
    this.asset = asset;
    this.yieldToken = this; // for Yearn, the Vault itself is the Yield Token
    this.priceOracle = priceOracle;
  }

  /**
   * @param totalSupply Total DAI supply
   */
  static async create(totalSupply:Number): Promise<Yearn> {
    // using WEI, because DAI has 18 decimal places
    const asset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalSupply));
    const pool = await ContractBase.deployContract("YearnVaultMock", asset.address());
    const priceOracle = await IPriceOracle.deploy("YearnPriceOracle");
    return new Yearn(pool, asset, priceOracle);
  }

  /**
   * @return Current Asset balance of the user as a decimal, eg. 1.0
   */
  async assetBalance(user:SignerOrAddress): Promise<NumberOrString> {
    return await this.asset.balanceOf(user);
  }

  /**
   * @return Yield Token balance of the user as a decimal, eg. 2.0
   */
  async yieldBalance(user:SignerOrAddress): Promise<NumberOrString> {
    let wei = await this.contract.balanceOf(addressOf(user));
    return this.fromBigNum(wei);
  }

  /**
   * @return current price of one share (1e18) , e.g. 1.1
   */
  async pricePerShare() : Promise<NumberOrString> {
    return fromWei(await this.contract.pricePerShare());
  }
  
  /**
   * Increases the price per share to a given target price
   */
  async increasePricePerShare(targetPrice: NumberOrString) {
    await this.contract.increasePricePerShare(toWei(targetPrice));
  }

  /**
   * Approves and deposits funds from User into the Yearn Vault
   * @param user User who wants to deposit tokens into Yearn Vault
   * @param amount # of token to deposit, eg: 1.0
   */
  async deposit(user:SignerOrAddress, amount:NumberOrString) {
    await this.asset.approve(user, this.address(), amount);
    await this.contract.connect(user).deposit(this.toBigNum(amount));
  }
}
