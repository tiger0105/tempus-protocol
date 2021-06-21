import { ethers } from "hardhat";
import { Contract, ethers } from "ethers";
import * as util from "../../ERC20"

/**
 * Sets up an AAVE Instance for Unit Testing, initializes liquidity for User
 * @param owner Owner of the pool who has some liquidity
 * @param user Second user which requires an initial liquidity
 * @return Deployed Aave instance
 */
export async function deployAavePoolMock(owner: ethers.Signer, user: ethers.Signer): Promise<Aave> {
  let BackingToken = await ethers.getContractFactory("ERC20FixedSupply");
  let backingAsset = await BackingToken.deploy("DAI Stablecoin", "DAI", 1000000);

  let AavePoolMock = await ethers.getContractFactory("AavePoolMock");
  let aavePool = await AavePoolMock.deploy(backingAsset.address);

  let ATokenMock = await ethers.getContractFactory("ATokenMock");
  let yieldToken = await ATokenMock.attach(await aavePool.yieldToken());

  // Pre-fund the user with 10000 backing tokens, and enter the pool
  await backingAsset.connect(owner).transfer(user.address, 10000);
  return new Aave(aavePool, new util.ERC20(backingAsset), new util.ERC20(yieldToken));
}

export class Aave {
  pool: Contract;
  asset: util.ERC20;
  yieldToken: util.ERC20;
  
  constructor(pool: Contract, asset: util.ERC20, yieldToken: util.ERC20) {
    this.pool = pool;
    this.asset = asset;
    this.yieldToken = yieldToken;
  }

  /**
   * Approves and deposits funds from User into the AAVE Pool
   * @param user User who wants to deposit ETH into AAVE Pool
   * @param ethAmount # of ETH to deposit, eg: 1.0
   */
  async deposit(user: ethers.Signer, ethAmount: number) {
    let wei = util.toWei(ethAmount);
    await this.asset.connect(user).approve(this.pool.address, wei);
    await this.pool.connect(user).deposit(this.asset.contract.address, wei, user.address, 0);
  }
}
