import { ethers } from "hardhat";
import { expect } from "chai";
import { toWei } from "../utils/Decimal"
import { expectRevert } from "../utils/Utils";
import { Signer } from "../utils/ContractBase";
import { TempusToken } from "../utils/TempusToken";

describe("Tempus Token", async () => {
  const totalTokenSupply = 100000000;
  let owner:Signer, user1:Signer, user2:Signer;
  let token:TempusToken;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    token = await TempusToken.deployClass(TempusToken, toWei(totalTokenSupply));
  });

  describe("Deploy", async () =>
  {
    it("Should mint initial supply to owner", async () =>
    {
      expect(await token.balanceOf(owner)).to.equal(totalTokenSupply);
      expect(await token.totalSupply()).to.equal(totalTokenSupply);
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
});
