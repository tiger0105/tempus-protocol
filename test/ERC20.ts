import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";

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
  constructor(contract: Contract) {
    this.contract = contract;
  }
  connect(signer): Contract {
    return this.contract.connect(signer);
  }
  async totalSupply() {
    return toEth(await this.contract.totalSupply());
  }
  async balanceOf(signerOrAddress) {
    return toEth(await this.contract.balanceOf(addressOf(signerOrAddress)));
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
