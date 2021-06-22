import { ethers } from "hardhat";
import { Signer, Contract, BigNumber } from "ethers";
import * as util from "../ERC20"

export class Aave {
  pool: Contract;
  asset: util.ERC20;
  earn: util.ERC20; // yield token
  
  constructor(pool: Contract, asset: util.ERC20, earn: util.ERC20) {
    this.pool = pool;
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
  static async deploy(owner:Signer, user:Signer, totalSupply:Number, userBalance:Number): Promise<Aave> {
    let BackingToken = await ethers.getContractFactory("ERC20FixedSupply");
    // using WEI, because DAI has 18 decimal places
    let backingAsset = await BackingToken.deploy("DAI Stablecoin", "DAI", util.toWei(totalSupply));

    let AavePoolMock = await ethers.getContractFactory("AavePoolMock");
    let aavePool = await AavePoolMock.deploy(backingAsset.address);

    let ATokenMock = await ethers.getContractFactory("ATokenMock");
    let yieldToken = await ATokenMock.attach(await aavePool.yieldToken());

    // Pre-fund the user with backing tokens
    await backingAsset.connect(owner).transfer(util.addressOf(user), util.toWei(userBalance));
    return new Aave(aavePool, new util.ERC20(backingAsset), new util.ERC20(yieldToken));
  }

  /**
   * @return Current Asset balance of the user as a decimal, eg. 1.0
   */
  async assetBalance(user: Signer): Promise<Number> {
    return await this.asset.balanceOf(user);
  }

  /**
   * @return Yield Token balance of the user as a decimal, eg. 2.0
   */
  async yieldBalance(user: Signer): Promise<Number> {
    let wei = await this.pool.getDeposit(util.addressOf(user));
    return util.toEth(wei);
  }

  /**
   * @return Current liquidity index of AAVE pool in RAY, which is 
   *         almost equivalent to reserve normalized income.
   */
  async liquidityIndex(): Promise<BigNumber> {
    return await this.pool.getReserveNormalizedIncome(this.asset.contract.address);
  }

  /**
   * Sets the AAVE pool's MOCK liquidity index in RAY
   */
  async setLiquidityIndex(rayLiquidityIndex:BigNumber) {
    await this.pool.setLiquidityIndex(rayLiquidityIndex);
  }

  /**
   * Approves and deposits funds from User into the AAVE Pool
   * @param user User who wants to deposit ETH into AAVE Pool
   * @param ethAmount # of ETH to deposit, eg: 1.0
   */
  async deposit(user: Signer, ethAmount: Number) {
    await this.asset.connect(user).approve(this.pool.address, ethAmount);
    await this.pool.connect(user).deposit(this.asset.contract.address, util.toWei(ethAmount), util.addressOf(user), 0);
  }
}
