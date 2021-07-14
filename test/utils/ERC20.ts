import { expect } from "chai";
import { Contract } from "ethers";
import { NumberOrString } from "./Decimal";
import { ContractBase, SignerOrAddress, Signer, addressOf } from "./ContractBase";

/**
 * Typed wrapper for ERC20 contracts
 */
export class ERC20 extends ContractBase {

  constructor(contractName:string,) {
    super(contractName, 18/*default decimals*/);
  }

  // initialize immutable fields
  protected async initialize(contract:Contract): Promise<ERC20>
  {
    super.initialize(contract);
    this.decimals = await this.contract.decimals();
    return this;
  }

  /**
   * Deploy a contract of type T which extends ERC20
   * @param contractName Name of the solidity contract
   * @param type Type of the ERC20 instance
   */
  static async deployClass<T extends ERC20>(type: new() => T, ...args: any[]): Promise<T> {
    const instance = new type();
    const contract = await this.deployContract(instance.contractName, ...args);
    await instance.initialize(contract);
    return instance;
  }

  /**
   * Deploys any ERC20 contract without a concrete backing TypeScript class
   */
  static async deploy(contractName:string, ...args: any[]): Promise<ERC20> {
    const contract = await this.deployContract(contractName, ...args);
    return await new ERC20(contractName).initialize(contract);
  }

  /**
   * Attaches to any contract address and attempts to convert it to ERC20
   * @param contractName Name of the solidity contract
   * @param contractAddress Address of the contract
   */
  static async attach(contractName:string, contractAddress:string): Promise<ERC20> {
    const contract = await this.attachContract(contractName, contractAddress);
    return await new ERC20(contractName).initialize(contract);
  }

  /** @return ERC20 name of this contract */
  async name(): Promise<string> { return await this.contract.name(); }

  /** @return ERC20 symbol of this contract */
  async symbol(): Promise<string> { return await this.contract.symbol(); }

  /**
   * @returns Total supply of this ERC20 token as a decimal, such as 10.0
   */
  async totalSupply(): Promise<NumberOrString> {
    return this.fromBigNum(await this.contract.totalSupply());
  }

  /**
   * @param account ERC20 account's address
   * @returns Balance of ERC20 address in decimals, eg 2.0
   */
  async balanceOf(account:SignerOrAddress): Promise<NumberOrString> {
    const amount = await this.contract.balanceOf(addressOf(account));
    return this.fromBigNum(amount);
  }

  /**
   * @dev Moves `amount` tokens from the sender's account to `recipient`.
   * @param sender The sender/caller of this transfer
   * @param recipient ERC20 transfer recipient's address
   * @param amount Amount of tokens to send in contract decimals, eg 2.0 or "0.00001"
   */
  async transfer(sender:SignerOrAddress, recipient:SignerOrAddress, etherAmount:NumberOrString) {
    const connected = this.connect(sender);
    return await connected.transfer(addressOf(recipient), this.toBigNum(etherAmount));
  }

  /**
   * @param owner ERC20 owner's address
   * @param spender ERC20 spender's address
   * @returns The remaining number of tokens that `spender` will be allowed to 
   * spend on behalf of `owner` through {transferFrom}. This is zero by default.
   */
  async allowance(owner:SignerOrAddress, spender:SignerOrAddress): Promise<NumberOrString> {
    const amount = await this.contract.allowance(addressOf(owner), addressOf(spender));
    return this.fromBigNum(amount);
  }
  
  /**
   * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
   * @param caller The caller who is sending this approve
   * @param spender ERC20 approve's, spender's address
   * @param amount Amount of tokens to approve in contract decimals, eg 2.0 or "0.00001"
   */
  async approve(caller:SignerOrAddress, spender:SignerOrAddress, amount:NumberOrString) {
    const connected = this.connect(caller);
    return await connected.approve(addressOf(spender), this.toBigNum(amount));
  }

  /**
   * @dev Moves `amount` tokens from `sender` to `recipient` using the
   * allowance mechanism. `amount` is then deducted from the caller's allowance.
   * @param sender ERC20 transferFrom sender's address
   * @param recipient ERC20 transferFrom recipient's address
   * @param amount Amount of tokens to send in contract decimals, eg 2.0 or "0.00001"
   */
  async transferFrom(sender:SignerOrAddress, recipient:SignerOrAddress, amount:NumberOrString) {
    await this.contract.transferFrom(addressOf(sender), addressOf(recipient), this.toBigNum(amount));
    // TODO: implement (bool) return?
  }

  /** Sends some ether directly to the contract,
   *  which is handled in the contract receive() function */
  async sendToContract(signer:Signer, amount:NumberOrString) {
    return signer.sendTransaction({
      from: signer.address,
      to: this.contract.address,
      value: this.toBigNum(amount)
    });
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
