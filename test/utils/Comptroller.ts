import { Contract, BigNumber, ethers } from "ethers";
import { NumberOrString, toWei, formatDecimal } from "./Decimal";
import { addressOf, ContractBase, SignerOrAddress, Signer } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IPriceOracle } from "./IPriceOracle";

export class Comptroller extends ContractBase {
  asset:ERC20; // backing asset DAI or null if ETH
  yieldToken:ERC20; // yield token - cDAI or CEther
  priceOracle:IPriceOracle;
  
  constructor(pool:Contract, asset: ERC20, yieldToken:ERC20, priceOracle:IPriceOracle) {
    super("ComptrollerMock", 18, pool);
    this.asset = asset;
    this.yieldToken = yieldToken;
    this.priceOracle = priceOracle;
  }

  /**
   * @param type Type of CToken, valid values are: 'CEther', 'CErc20'
   *             If type is 'CEther', then there's no asset token
   *             If type is 'CErc20', then asset token is DAI
   * @param totalErc20Supply If type is 'CErc20', this is the total supply
   */
  static async create(type:string, totalErc20Supply:Number = 0): Promise<Comptroller> {
    const pool = await ContractBase.deployContract("ComptrollerMock");
    const priceOracle = await IPriceOracle.deploy("CompoundPriceOracle");

    if (type == 'CErc20') {
      let asset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalErc20Supply));
      const cDAI = await ERC20.deploy("CErc20", pool.address, asset.address, "Compound DAI Yield Token", "cDAI");
      return new Comptroller(pool, asset, cDAI, priceOracle);
    }
    if (type == 'CEther') {
      const cEther = await ERC20.deploy("CEther", pool.address, "Compound ETH Yield Token", "CEther");
      return new Comptroller(pool, null, cEther, priceOracle);
    }
    throw new Error("Invalid CToken type: " + type);
  }

  /**
   * @return Current Asset balance of the user as a decimal, eg. 1.0
   */
  async assetBalance(user:SignerOrAddress): Promise<NumberOrString> {
    if (this.asset == null) {
      if (typeof(user) === 'string') {
        return this.fromBigNum(await ethers.getDefaultProvider().getBalance(user));
      }
      return this.fromBigNum(await user.getBalance());
    }
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
    const results:BigNumber[] = await this.contract.connect(user).enterMarkets([this.yieldToken.address]);
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
    const result:BigNumber = await this.contract.connect(user).exitMarket(this.yieldToken.address);
    return result == BigNumber.from("0"); // no error
  }

  /**
   * @dev MOCK ONLY
   * @return True if user is particiapnt in cToken market
   */
  async isParticipant(user:SignerOrAddress): Promise<boolean> {
    return await this.contract.isParticipant(this.yieldToken.address, addressOf(user));
  }

  /**
   * Is minting allowed for this user and this CToken?
   * @param user User to check
   * @param mintAmount How much he wants to mint
   */
  async mintAllowed(user:SignerOrAddress, mintAmount:NumberOrString): Promise<boolean> {
    return await this.contract.mintAllowed(this.yieldToken.address, addressOf(user), this.toBigNum(mintAmount)) == 0;
  }

  /**
   * Calls payable mint on the CToken, which means CToken must be CEther
   */
  async mintEther(user:SignerOrAddress, ethAmount:NumberOrString) {
    if (this.asset != null) {
      throw new Error("Asset is not CEther");
    }
    const wei = toWei(ethAmount);
    await this.yieldToken.contract.connect(user).mint({value: wei});
  }

  /**
   * Calls CErc20 mint() on the CToken, which means CToken must be CErc20 (like cDAI)
   */
  async mintERC20(user:SignerOrAddress, amount:NumberOrString) {
    if (this.asset == null) {
      throw new Error("Asset is not CErc20");
    }
    const assetAmount = this.asset.toBigNum(amount);
    await this.asset.approve(user, this.yieldToken.address, amount);
    await this.yieldToken.contract.connect(user).mint(assetAmount);
  }

  /**
   * Mints either CErc20 or CEther tokens depending on the underlying CToken
   */
  async mint(user:SignerOrAddress, amount:NumberOrString) {
    if (this.asset == null) {
      return await this.mintEther(user, amount);
    }
    return await this.mintERC20(user, amount);
  }
}
