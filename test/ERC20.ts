import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";

/** @return WEI BigNumber from an ETH decimal */
export function toWei(eth:Number): BigNumber {
    return ethers.utils.parseEther(eth.toString());
}

/** @return ETH decimal from WEI BigNumber */
export function toEth(wei:BigNumber): Number {
    return Number(ethers.utils.formatEther(wei));
}

/** @return Address field from signer or Address */
export function addressOf(signerOrAddress) {
  if (signerOrAddress.address)
    return signerOrAddress.address;
  return signerOrAddress;
}

/**
 * Simple contract wrapper
 */
export class ERC20 {

  contract: Contract;
  connected: any;

  constructor(contract: Contract, connected = null) {
    this.contract = contract;
    this.connected = connected;
  }

  /** Connects a user to the contract, so that transactions can be sent by the user */
  connect(signerOrProvider): ERC20 {
    if (this.connected == signerOrProvider) {
      return this; // already connected
    }
    return new ERC20(this.contract.connect(signerOrProvider), signerOrProvider);
  }

  /** @return Address of the contract */
  address(): string { return this.contract.address; }

  /**
   * @returns Total supply of this ERC20 token as a decimal, such as 10.0
   */
  async totalSupply() {
    return toEth(await this.contract.totalSupply());
  }

  /**
   * @param signerOrAddress A Signer or any address string
   * @returns 
   */
  async balanceOf(signerOrAddress) {
    return toEth(await this.contract.balanceOf(addressOf(signerOrAddress)));
  }
  
  /**
   * @param spender ERC20 approve's, spender's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async approve(spender, etherAmount:Number) {
    return await this.contract.approve(addressOf(spender), toWei(etherAmount));
  }

  /**
   * @dev The SENDER should be connected via connect()
   * @param recipient ERC20 transfer recipient's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async transfer(recipient, etherAmount:Number) {
    return await this.contract.transfer(addressOf(recipient), toWei(etherAmount));
  }

  /**
   * @param sender ERC20 transferFrom sender's address
   * @param recipient ERC20 transferFrom recipient's address
   * @param etherAmount Amount of ether to send in decimals, eg 2.0
   */
  async transferFrom(sender, recipient, etherAmount:Number) {
    return await this.contract.transferFrom(addressOf(sender), addressOf(recipient), toWei(etherAmount));
  }

  /** Sends some ether directly to the contract,
   *  which is handled in the contract receive() function */
  async sendToContract(signer, etherAmount:Number) {
    return signer.sendTransaction({
      from: signer.address,
      to: this.contract.address,
      value: toWei(etherAmount)
    });
  }
}

export async function deploy(contractName:string): Promise<Contract> {
  let factory = await ethers.getContractFactory(contractName);
  return await factory.deploy();
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
      let revertMessage = e.message.substr(expectedPrefix.length);
      return expect(revertMessage);
    }
    return expect(e.message); // something else failed
  }
}
