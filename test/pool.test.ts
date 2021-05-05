import { ethers } from "hardhat";
import { Signer } from "ethers";

describe("Pool tests", async () => {
  let accounts: Signer[];
  
  beforeEach(async () => {
    accounts = await ethers.getSigners();
  });

  it("Deploy", async () => {
    // Do something
  });
});