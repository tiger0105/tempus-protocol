import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import { ERC20, Signer, deploy, toWei, toEth, addressOf } from "../ERC20"

export class Aave {
  pool: Contract;
  asset: ERC20;
  earn: ERC20; // yield token
  
  constructor(pool: Contract, asset: ERC20, earn: ERC20) {
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
    // using WEI, because DAI has 18 decimal places
    const backingAsset = await ERC20.deploy("ERC20FixedSupply", "DAI Stablecoin", "DAI", toWei(totalSupply));
    const aavePool = await deploy("AavePoolMock", backingAsset.address());
    const yieldToken = await ERC20.attach("ATokenMock", await aavePool.yieldToken());

    // Pre-fund the user with backing tokens
    await backingAsset.connectERC20(owner).transfer(addressOf(user), userBalance);
    return new Aave(aavePool, backingAsset, yieldToken);
  }

  /**
   * @return Current Asset balance of the user as a decimal, eg. 1.0
   */
  async assetBalance(user:Signer): Promise<Number> {
    return await this.asset.balanceOf(user);
  }

  /**
   * @return Yield Token balance of the user as a decimal, eg. 2.0
   */
  async yieldBalance(user:Signer): Promise<Number> {
    let wei = await this.pool.getDeposit(addressOf(user));
    return toEth(wei);
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
  async deposit(user:Signer, ethAmount:Number) {
    await this.asset.connectERC20(user).approve(this.pool.address, ethAmount);
    await this.pool.connect(user).deposit(this.asset.contract.address, toWei(ethAmount), addressOf(user), 0);
  }
}
