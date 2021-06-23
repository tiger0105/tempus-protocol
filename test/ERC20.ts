import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import * as signers from "@nomiclabs/hardhat-ethers/signers"

/**
 * Parses a decimal string into specified base precision
 * @example let wei = parseDecimal("0.000001", 18);
 * @param decimalString Decimal string such as "12.1234"
 * @param decimalBase Base precision of the decimal, for wei=18, for ray=27 
 * @returns BigNumber for use in solidity contracts
 */
export function parseDecimal(decimalString:string, decimalBase:number): BigNumber {
  return ethers.utils.parseUnits(decimalString, decimalBase);
}

/** @return WEI BigNumber from an ETH decimal */
export function toWei(eth:Number): BigNumber {
  return parseDecimal(eth.toString(), 18);
}

/** @return RAY BigNumber from a decimal number */
export function toRay(decimal:Number): BigNumber {
  return parseDecimal(decimal.toString(), 27);
}

/** @return ETH decimal from WEI BigNumber */
export function toEth(wei:BigNumber): Number {
  return Number(ethers.utils.formatEther(wei));
}

export type Signer = signers.SignerWithAddress;
export type SignerOrAddress = Signer|string;

/** @return Address field from signer or address string */
export function addressOf(signer:SignerOrAddress) {
  if (typeof(signer) === "string")
    return signer;
  if (signer.address)
    return signer.address;
  throw new Error("Invalid signer (no address): " + signer);
}

/**
 * Deploy a contract of any type
 * @param contractName Name of the solidity contract
 * @param args... Optional arguments for the deployed contract
 */
export async function deploy(contractName:string, ...args: any[]): Promise<Contract> {
  const factory = await ethers.getContractFactory(contractName);
  return await factory.deploy(...args);
}

/**
 * Attaches to any contract address
 * @param contractName Name of the solidity contract
 * @param contractAddress Address of the contract
 */
 export async function attach(contractName:string, contractAddress:string): Promise<Contract> {
  const factory = await ethers.getContractFactory(contractName);
  return await factory.attach(contractAddress);
}

/**
 * Typed wrapper for ERC20 contracts
 */
export class ERC20 {
  contractName:string;
  contract:Contract;
  connected:any;

  constructor(contractName:string, contract:Contract = null) {
    this.contractName = contractName;
    this.contract = contract;
  }
  
  /** @return Address of the contract */
  address(): string { return this.contract.address; }

  /**
   * Deploy a contract of type T which extends ERC20
   * @param contractName Name of the solidity contract
   * @param type Type of the ERC20 instance
   */
  static async deployClass<T extends ERC20>(type: new() => T, ...args: any[]): Promise<T> {
    const instance = new type();
    if (!instance.contractName)
      throw new Error("ERC20 instance must set contractName in constructor");
    instance.contract = await deploy(instance.contractName, ...args);
    return instance;
  }

  /**
   * Deploys any ERC20 contract without a concrete backing TypeScript class
   */
  static async deploy(contractName:string, ...args: any[]): Promise<ERC20> {
    const contract = await deploy(contractName, ...args);
    return new ERC20(contractName, contract);
  }

  /**
   * Attaches to any contract address and attempts to convert it to ERC20
   * @param contractName Name of the solidity contract
   * @param contractAddress Address of the contract
   */
  static async attach(contractName:string, contractAddress:string): Promise<ERC20> {
    return new ERC20(contractName, await attach(contractName, contractAddress));
  }

  /** Connects a user to the contract, so that transactions can be sent by the user */
  connect(user:SignerOrAddress): Contract {
    return this.contract.connect(user);
  }

  /** Connects as a generic ERC20 contract */
  connectERC20(user:SignerOrAddress): ERC20 {
    if (this.connected == user) {
      return this; // already connected
    }
    const erc20 = new ERC20(this.contractName, this.connect(user));
    erc20.connected = user;
    return erc20;
  }

  /** @return ERC20 name of this contract */
  async name(): Promise<string> { return await this.contract.name(); }

  /** @return ERC20 symbol of this contract */
  async symbol(): Promise<string> { return await this.contract.symbol(); }

  /**
   * @returns Total supply of this ERC20 token as a decimal, such as 10.0
   */
  async totalSupply(): Promise<Number> {
    return toEth(await this.contract.totalSupply());
  }

  /**
   * @param account ERC20 account's address
   * @returns Balance of ERC20 address in decimals, eg 2.0
   */
  async balanceOf(account:SignerOrAddress): Promise<Number> {
    return toEth(await this.contract.balanceOf(addressOf(account)));
  }

  /**
   * @dev Moves `amount` tokens from the sender's account to `recipient`.
   * @warning The caller should be connected via connect()
   * @param recipient ERC20 transfer recipient's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async transfer(recipient:SignerOrAddress, etherAmount:Number) {
    this.checkIsConnected("transfer");
    return await this.contract.transfer(addressOf(recipient), toWei(etherAmount));
  }

  /**
   * @param owner ERC20 owner's address
   * @param spender ERC20 spender's address
   * @returns The remaining number of tokens that `spender` will be allowed to 
   * spend on behalf of `owner` through {transferFrom}. This is zero by default.
   */
  async allowance(owner:SignerOrAddress, spender:SignerOrAddress): Promise<Number> {
    return toEth(await this.contract.allowance(addressOf(owner), addressOf(spender)));
  }
  
  /**
   * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
   * @warning The caller should be connected via connect()
   * @param spender ERC20 approve's, spender's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async approve(spender:SignerOrAddress, etherAmount:Number) {
    this.checkIsConnected("approve");
    return await this.contract.approve(addressOf(spender), toWei(etherAmount));
  }

  /**
   * @dev Moves `amount` tokens from `sender` to `recipient` using the
   * allowance mechanism. `amount` is then deducted from the caller's allowance.
   * @param sender ERC20 transferFrom sender's address
   * @param recipient ERC20 transferFrom recipient's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async transferFrom(sender:SignerOrAddress, recipient:SignerOrAddress, etherAmount:Number) {
    await this.contract.transferFrom(addressOf(sender), addressOf(recipient), toWei(etherAmount));
    // TODO: implement (bool) return?
  }

  /** Sends some ether directly to the contract,
   *  which is handled in the contract receive() function */
  async sendToContract(signer:Signer, etherAmount:Number) {
    return signer.sendTransaction({
      from: signer.address,
      to: this.contract.address,
      value: toWei(etherAmount)
    });
  }

  protected checkIsConnected(what) {
    if (!this.connected) {
      throw new Error(what + " requires an active connection");
    }
  }
}

/**
 * Expect called promise to revert with message
 * (await util.revert(lido.withdraw(..))).to.equal("expected revert msg");
 */
export async function revert(promise: Promise<any>): Promise<Chai.Assertion> {
  try {
    await promise;
    return expect('TX_NOT_REVERTED');
  } catch (e) {
    const expectedPrefix = "VM Exception while processing transaction: revert ";
    if (e.message.startsWith(expectedPrefix)) {
      const revertMessage = e.message.substr(expectedPrefix.length);
      return expect(revertMessage);
    }
    return expect(e.message); // something else failed
  }
}
