import { ethers } from "hardhat";
import { expect } from "chai";

/**
 * @returns Latest timestamp of the blockchain
 */
export async function blockTimestamp() : Promise<number> {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

/**
 * Increase current EVM time by seconds
 */
export async function increaseTime(addSeconds: number) : Promise<void> {
  await ethers.provider.send("evm_increaseTime", [addSeconds]);
  await ethers.provider.send("evm_mine", []);
}


/**
 * Expect called promise to revert with message
 * (await expectRevert(lido.withdraw(..))).to.equal("expected revert msg");
 */
export async function expectRevert(promise: Promise<any>): Promise<Chai.Assertion> {
  try {
    await promise;
    return expect('TX_NOT_REVERTED');
  } catch (e) {
    const expectedErrorMsg = "VM Exception while processing transaction: revert ";
    let idx = e.message.indexOf(expectedErrorMsg);
    if (idx !== -1) {
      const revertMessage = e.message.substr(idx + expectedErrorMsg.length);
      return expect(revertMessage);
    }
    return expect(e.message); // something else failed
  }
}
