import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { NumberOrString, toWei, ONE_WEI } from "./Decimal";
import { ContractBase, SignerOrAddress, addressOf } from "./ContractBase";
import { ERC20 } from "./ERC20";
import { IPriceOracle } from "./IPriceOracle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";

/**
 * Type safe wrapper over LidoMock
 */
export class Lido extends ERC20 {
  asset:ERC20; // ETH
  yieldToken:ERC20; // StETH
  priceOracle:IPriceOracle;

  constructor(pool:Contract, asset:ERC20, priceOracle:IPriceOracle) {
    super("LidoMock", pool);
    this.asset = asset;
    this.yieldToken = this; // for Lido, the pool itself is the Yield Token
    this.priceOracle = priceOracle;
  }
  
  /**
   * @param totalSupply Total ETH supply
   */
  static async create(totalSupply:Number): Promise<Lido> {
    // using WEI, because ETH has 18 decimal places
    const asset = await ERC20.deploy("ERC20FixedSupply", "ETH Mock", "ETH", toWei(totalSupply));
    const pool = await ContractBase.deployContract("LidoMock");
    const priceOracle = await IPriceOracle.deploy("StETHPriceOracle");
    return new Lido(pool, asset, priceOracle);
  }

  /** @return stETH balance of an user */
  async sharesOf(user:SignerOrAddress): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.sharesOf(addressOf(user)));
  }

  /** @return total stETH shares minted */
  async getTotalShares(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getTotalShares());
  }

  /** @return the amount of Ether that corresponds to `_sharesAmount` token shares. */
  async getPooledEthByShares(sharesAmount:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getPooledEthByShares(this.toBigNum(sharesAmount)));
  }

  /** @return the amount of shares that corresponds to `_ethAmount` protocol-controlled Ether. */
  async getSharesByPooledEth(_ethAmount:NumberOrString): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.getSharesByPooledEth(this.toBigNum(_ethAmount)));
  }

  /** @return total pooled ETH: beaconBalance + bufferedEther */
  async totalSupply(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.totalSupply());
  }

  /** @return Current exchange rate */
  async exchangeRate(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract._currentExchangeRate());
  }

  /**
   * Sets the pool exchange rate
   * The only way to do this is to modify the `totalShares` of stETH in the contract
   * @param exchangeRate New synthetic exchange rate
   */
  async setExchangeRate(exchangeRate:NumberOrString) {
    let totalETHSupply:BigNumber = await this.contract.totalSupply();
    // total ETH is 0, so we must actually deposit something, otherwise we can't manipulate the rate
    if (totalETHSupply.isZero()) {
      totalETHSupply = this.toBigNum(100);
      await this.contract._setSharesAndEthBalance(this.toBigNum(100), totalETHSupply); // 1.0 rate
    }

    // figure out if newRate requires a change of stETH
    const totalShares:BigNumber = await this.contract.getTotalShares();
    const curRate = (totalShares.mul(ONE_WEI)).div(totalETHSupply);
    const newRate = this.toBigNum(exchangeRate);
    const difference = newRate.mul(ONE_WEI).div(curRate).sub(ONE_WEI);
    if (difference.isZero())
      return;

    const change = totalShares.mul(difference).div(ONE_WEI);
    const newShares = totalShares.add(change);
    await this.contract._setSharesAndEthBalance(newShares, totalETHSupply);
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
  async pushBeacon(owner: SignerWithAddress, validators:number, balance:number) {
    return await this.connect(owner).pushBeacon(validators, toWei(balance));
  }
  // pushes balance to achieve certain amount of `totalRewards`
  async pushBeaconRewards(owner: SignerWithAddress, validators:number, rewards:number) {
    // push X eth reward, rewards = balance - 32*validators
    const balance = rewards + 32*validators;
    return await this.pushBeacon(owner, validators, balance);
  }
  async withdraw(signer: SignerWithAddress, shareAmount:Number) {
    // We ignore the pubKeyHash.
    const hash =  ethers.utils.formatBytes32String("");
    return await this.connect(signer).withdraw(toWei(shareAmount), hash);
  }
  async printState(title: string, owner: string, user: string) {
    console.log("State:", title);
    console.log("  totalSupply:", await this.totalSupply());
    console.log("  totalShares:", await this.getTotalShares());
    console.log("  owner.shares: ", await this.sharesOf(owner));
    console.log("  owner.balance:", await this.balanceOf(owner));
    console.log("  user.shares: ", await this.sharesOf(user));
    console.log("  user.balance:", await this.balanceOf(user));
  }
}
