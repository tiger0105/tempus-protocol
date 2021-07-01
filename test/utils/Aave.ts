import { Contract, BigNumber } from "ethers";
import { NumberOrString, toWei, toRay, fromRay } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";

export class Aave extends ContractBase {
  asset: ERC20;
  earn: ERC20; // yield token
  
  constructor(pool: Contract, asset: ERC20, earn: ERC20) {
    super("AavePoolMock", 18, pool);
    this.asset = asset;
    this.earn = earn;
  }

  /**
   * Sets up an AAVE Instance for Unit Testing, initializes liquidity for User
   * @param owner Owner of the pool who has some liquidity
   * @param user Second user which requires an initial liquidity
   * @param totalSupply Total DAI supply
   * @param userBalance How much to transfer to user
   * @return Deployed Aave instance
   */
  static async deploy(owner:SignerOrAddress, user:SignerOrAddress, totalSupply:Number, userBalance:Number): Promise<Aave> {
    // using WEI, because DAI has 18 decimal places
    const backingAsset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalSupply));
    const aavePool = await ContractBase.deployContract("AavePoolMock", backingAsset.address());
    const yieldToken = await ERC20.attach("ATokenMock", await aavePool.yieldToken());

    // Pre-fund the user with backing tokens
    await backingAsset.transfer(owner, user, userBalance);
    return new Aave(aavePool, backingAsset, yieldToken);
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
    let wei = await this.contract.getDeposit(addressOf(user));
    return this.fromBigNum(wei);
  }

  /**
   * @return Current liquidity index of AAVE pool in RAY, which is 
   *         almost equivalent to reserve normalized income.
   */
  async liquidityIndex(): Promise<NumberOrString> {
    return fromRay(await this.contract.getReserveNormalizedIncome(this.asset.address()));
  }

  /**
   * Sets the AAVE pool's MOCK liquidity index in RAY
   */
  async setLiquidityIndex(liquidityIndex:NumberOrString) {
    await this.contract.setLiquidityIndex(toRay(liquidityIndex));
  }

  /**
   * Approves and deposits funds from User into the AAVE Pool
   * @param user User who wants to deposit ETH into AAVE Pool
   * @param amount # of ETH to deposit, eg: 1.0
   */
  async deposit(user:SignerOrAddress, amount:NumberOrString) {
    await this.asset.approve(user, this.address(), amount);
    await this.contract.connect(user).deposit(this.asset.address(), this.toBigNum(amount), addressOf(user), 0);
  }
}
