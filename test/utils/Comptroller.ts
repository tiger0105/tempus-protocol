import { Contract, BigNumber } from "ethers";
import { NumberOrString, toWei, formatDecimal } from "./Decimal";
import { addressOf, ContractBase, SignerOrAddress } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IAssetPool } from "./IAssetPool";

export class Comptroller extends ContractBase {
  asset:ERC20; // backing asset - DAI
  yieldToken:ERC20; // yield token - cDAI
  assetPool:IAssetPool;
  
  constructor(pool:Contract, asset: ERC20, yieldToken:ERC20, assetPool:IAssetPool) {
    super("AavePoolMock", 18, pool);
    this.asset = asset;
    this.yieldToken = yieldToken;
    this.assetPool = assetPool;
  }

  /**
   * @param totalSupply Total DAI supply
   */
  static async create(totalSupply:Number): Promise<Comptroller> {
    // using WEI, because DAI has 18 decimal places
    const asset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalSupply));
    const pool = await ContractBase.deployContract("ComptrollerMock", asset.address());
    const yieldToken = await ERC20.attach("CErc20", await pool.yieldToken());
    const assetPool = await IAssetPool.deploy("CompoundAssetPool", yieldToken);
    return new Comptroller(pool, asset, yieldToken, assetPool);
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
    return await this.yieldToken.balanceOf(user);
  }

  /**
   * @return Current exchange rate in 1e18 decimal
   */
  async exchangeRate(): Promise<NumberOrString> {
    const rate:BigNumber = await this.contract.exchangeRate();
    return formatDecimal(rate, 18);
  }

  /**
   * Sets the pool exchange rate in 1e18 decimal
   */
  async setExchangeRate(exchangeRate:NumberOrString) {
    await this.contract.setExchangeRate(toWei(exchangeRate));
  }

  /**
   * @notice Add assets to be included in account liquidity calculation
   * @return Success indicator for whether each corresponding market was entered
   */
  async enterMarkets(user:SignerOrAddress): Promise<boolean> {
    const results:BigNumber[] = await this.contract.connect(user).enterMarkets([this.yieldToken.address()]);
    return results[0] == BigNumber.from("0"); // no error
  }

  /**
   * @notice Removes asset from sender's account liquidity calculation
   * @dev Sender must not have an outstanding borrow balance in the asset,
   *  or be providing necessary collateral for an outstanding borrow.
   * @param cTokenAddress The address of the asset to be removed
   * @return Whether or not the account successfully exited the market
   */
  async exitMarket(user:SignerOrAddress): Promise<boolean> {
    const result:BigNumber = await this.contract.connect(user).exitMarket(this.yieldToken.address());
    return result == BigNumber.from("0"); // no error
  }

  /**
   * @dev MOCK ONLY
   * @return True if user is particiapnt in cToken market
   */
  async isParticipant(user:SignerOrAddress): Promise<boolean> {
    return await this.contract.isParticipant(this.yieldToken.address(), addressOf(user));
  }

  /**
   * Send a payable deposit to the yield token, which will enter us into the pool
   */
  async payableDeposit(user:SignerOrAddress, amount:NumberOrString) {
    await this.asset.approve(user, this.yieldToken.address(), amount);
    const val = this.yieldToken.toBigNum(amount); // payable call, set value:
    await this.yieldToken.contract.connect(user).mint({value: val});
  }
}
