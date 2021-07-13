import { ethers } from "hardhat";

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
