import { ethers } from "hardhat";
import { expect } from "chai";
import { blockTimestamp, expectRevert, increaseTime } from "../utils/Utils";
import { Signer } from "../utils/ContractBase";
import { TempusToken } from "../utils/TempusToken";
import { DAY } from "../utils/TempusAMM";

describe("Tempus Token", async () => {
  let owner:Signer, user1:Signer, user2:Signer;
  let token:TempusToken;
  let deploymentTime:number;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    deploymentTime = await blockTimestamp();
    token = await TempusToken.deployClass(TempusToken);
  });

  describe("Deploy", async () =>
  {
    it("Should set correct minting times", async () =>
    {
      expect(await token.lastMintingTime()).gte(deploymentTime);
      expect(await token.mintAllowedAfter()).gte(deploymentTime + 365 * DAY * 3);
    });
    it("Should mint initial supply to owner", async () =>
    {
      expect(await token.balanceOf(owner)).to.equal(1e9);
      expect(await token.totalSupply()).to.equal(1e9);
    });

    it("Should set name and symbol", async () =>
    {
      expect(await token.name()).to.equal("Tempus");
      expect(await token.symbol()).to.equal("TEMP");
    });
  });
  
  describe("Burn", async () =>
  {
    it("Should allow users to burn their own tokens", async () =>
    {
      const amount = 10;
      const initialTotalSupply = await token.totalSupply();

      await token.transfer(owner, user1, amount); // Owner transfers to User
      expect(await token.balanceOf(user1)).to.equal(amount);

      // User tries to burn its own tokens
      await token.burn(user1, amount);
      expect(await token.balanceOf(user1)).to.equal(0);
      expect(await token.totalSupply()).to.equal(Number(initialTotalSupply) - amount);
    });
  });

  describe("Mint", async () =>
  {
    it("Should revert on minting", async () =>
    {
      (await expectRevert(token.mint(owner, user1, 2e7))).to.equal("Minting not allowed yet.");
      await increaseTime(DAY * 365 * 3);
      (await expectRevert(token.mint(owner, user1, 2e8))).to.equal("Mint cap limit.");
      await token.mint(owner, user1, 2e7);
      (await expectRevert(token.mint(owner, user1, 2e7))).to.equal("Not enough time between mints.");
    });

    it("Mint should increase total supply correctly", async () =>
    {
      await increaseTime(DAY * 365 * 3);
      const lastMintTime = await blockTimestamp();
      await token.mint(owner, user1, 2e7);
      expect(await token.lastMintingTime()).gte(lastMintTime);
      expect(await token.balanceOf(user1)).to.equal(2e7);
      expect(await token.totalSupply()).to.equal(1e9 + 2e7);
    });
  });
});
