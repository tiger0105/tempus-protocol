import { ethers } from "hardhat";
import { Contract } from "ethers";
import { NumberOrString, toWei } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IAssetPool } from "./IAssetPool";

/**
 * Type safe wrapper over LidoMock
 */
export class Lido extends ERC20 {
  asset:ERC20; // ETH
  yieldToken:ERC20; // StETH
  assetPool:IAssetPool;

  constructor(pool:Contract, asset:ERC20, assetPool:IAssetPool) {
    super("LidoMock");
    this.contract = pool;
    this.asset = asset;
    this.yieldToken = this; // for Lido, the pool itself is the Yield Token
    this.assetPool = assetPool;
  }
  
  /**
   * @param totalSupply Total ETH supply
   */
  static async create(totalSupply:Number): Promise<Lido> {
    // using WEI, because ETH has 18 decimal places
    const asset = await ERC20.deploy("ERC20FixedSupply", "ETH Mock", "ETH", toWei(totalSupply));
    const lido = await ContractBase.deployContract("LidoMock");
    const yieldToken = await ERC20.attach("LidoMock", lido.address);
    const assetPool = await IAssetPool.deploy("StETHAssetPool", yieldToken);
    return new Lido(lido, asset, assetPool);
  }

  async sharesOf(signer:SignerOrAddress): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.sharesOf(addressOf(signer)));
  }
  async getTotalShares(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getTotalShares());
  }
  async submit(signer:SignerOrAddress, amount:NumberOrString) {
    const val = this.toBigNum(amount); // payable call, set value:
    return await this.connect(signer).submit(addressOf(signer), {value: val})
  }
  async depositBufferedEther() {
    // ethers.js does not resolve overloads, so need to call the function by string lookup
    return await this.contract["depositBufferedEther()"]();
  }
  async depositBufferedEther2(maxDeposits:number) {
    return await this.contract["depositBufferedEther(uint256)"](maxDeposits);
  }
  /**
   * Updates the contract with information from ETH2 orcale
   * Calculates rewards using formulae:  rewards = balance - 32*validators
   * @param validators Total number of ACTUAL 32xETH deposits made during deposit event.
   *                   This could be different than # of depositBufferedEther(1) calls.
   * @param balance Actual balance in the ETH2 oracle
   */
  async pushBeacon(owner, validators:number, balance:number) {
    return await this.connect(owner).pushBeacon(validators, toWei(balance));
  }
  // pushes balance to achieve certain amount of `totalRewards`
  async pushBeaconRewards(owner, validators:number, rewards:number) {
    // push X eth reward, rewards = balance - 32*validators
    const balance = rewards + 32*validators;
    return await this.pushBeacon(owner, validators, balance);
  }
  async withdraw(signer, shareAmount:Number) {
    // We ignore the pubKeyHash.
    const hash =  ethers.utils.formatBytes32String("");
    return await this.connect(signer).withdraw(toWei(shareAmount), hash);
  }
  async printState(title, owner, user) {
    console.log("State:", title);
    console.log("  totalSupply:", await this.totalSupply());
    console.log("  totalShares:", await this.getTotalShares());
    console.log("  owner.shares: ", await this.sharesOf(owner));
    console.log("  owner.balance:", await this.balanceOf(owner));
    console.log("  user.shares: ", await this.sharesOf(user));
    console.log("  user.balance:", await this.balanceOf(user));
  }
}
