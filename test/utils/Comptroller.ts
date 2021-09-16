import { Contract, BigNumber } from "ethers";
import { formatDecimal, NumberOrString, parseDecimal, toWei } from "./Decimal";
import { addressOf, ContractBase, SignerOrAddress } from "./ContractBase";
import { ERC20 } from "./ERC20";

export class Comptroller extends ContractBase {
  asset:ERC20; // backing asset DAI or null if ETH
  yieldToken:ERC20; // yield token - cDAI or CEther
  
  constructor(pool:Contract, asset: ERC20|null, yieldToken:ERC20) {
    super("ComptrollerMock", 18, pool);
    this.asset = asset!;
    this.yieldToken = yieldToken;
    if (yieldToken.decimals !== 8) {
      throw new Error("Compound's YieldToken cDAI must have 8 decimal precision");
    }
  }

  /**
   * @note We only support CErc20 because CEther has almost no yield
   * @param totalErc20Supply Total supply amount of the asset token
   * @param initialRate Initial interest rate
   */
  static async create(totalErc20Supply:Number = 0, initialRate:Number = 1.0): Promise<Comptroller> {
    const pool = await ContractBase.deployContract("ComptrollerMock");
    let asset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalErc20Supply));
    const cDAI = await ERC20.deploy("CErc20", pool.address, asset.address, "Compound DAI Yield Token", "cDAI");
    const comptroller = new Comptroller(pool, asset, cDAI);
    if (initialRate != 1.0) {
      await comptroller.setExchangeRate(initialRate);
    }
    return comptroller;
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
   * @return Current Exchange Rate, converted from 1e28 decimal
   *         The default initial exchange rate on compound is 0.02
   */
  async exchangeRate(): Promise<NumberOrString> {
    return formatDecimal(await this.contract.exchangeRate(), 28);
  }

  /**
   * Sets the pool Exchange Rate, converting it to an 1e28 decimal
   */
  async setExchangeRate(exchangeRate:NumberOrString, owner:SignerOrAddress = null) {
    if (owner !== null) {
      const prevExchangeRate = await this.exchangeRate();
      const difference = (Number(exchangeRate) / Number(prevExchangeRate)) - 1;
      if (difference > 0) {
        const totalSupply = await this.asset.balanceOf(this.yieldToken.address);
        const increaseBy = Number(totalSupply) * difference;
        await this.asset.transfer(owner, this.yieldToken.address, increaseBy);
      }
    }
    await this.contract.setExchangeRate(parseDecimal(exchangeRate.toString(), 28));
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
    return await this.contract.mintAllowed(this.yieldToken.address, addressOf(user), this.asset.toBigNum(mintAmount)) == 0;
  }

  /**
   * Calls CErc20 mint() on the CToken, which means CToken must be CErc20 (like cDAI)
   */
  async mint(user:SignerOrAddress, amount:NumberOrString) {
    await this.asset.approve(user, this.yieldToken.address, amount);
    await this.yieldToken.contract.connect(user).mint(this.asset.toBigNum(amount));
  }
}
