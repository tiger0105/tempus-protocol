import { ethers } from "hardhat";

export async function blockTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

export async function increaseTime(addSeconds) {
  await ethers.provider.send("evm_increaseTime", [addSeconds]);
  await ethers.provider.send("evm_mine", []);
}