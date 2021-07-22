import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * @returns Latest timestamp of the blockchain
 */
export async function blockTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

/**
 * Increase current EVM time by seconds
 */
export async function increaseTime(addSeconds) {
  await ethers.provider.send("evm_increaseTime", [addSeconds]);
  await ethers.provider.send("evm_mine", []);
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
