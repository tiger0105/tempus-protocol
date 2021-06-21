import { ethers } from "hardhat";
import { expect } from "chai";
import { toWei } from "../utils/Decimal"

describe("Tempus Token", async () => {
  const totalTokenSupply = toWei(100000000);
  let owner, user1, user2;
  let TempusToken;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    const tempusTokenContractFactory = await ethers.getContractFactory("TempusToken");
    TempusToken = await tempusTokenContractFactory.connect(owner).deploy(totalTokenSupply);
  });

  function transfer(sender, receiver, amount) {
    return TempusToken.connect(sender).transfer(receiver.address, amount);
  }

  function burn(sender, receiver, amount) {
    return TempusToken.connect(sender).burn(receiver.address, amount);
  }

  async function expectBalanceOf(signer): Promise<Chai.Assertion> {
    return expect(await TempusToken.balanceOf(signer.address));
  }

  async function expectTotalSupply(): Promise<Chai.Assertion> {
    return expect(await TempusToken.totalSupply());
  }

  function expectRevert(promise, message = null) {
    return message ?
      expect(promise).to.be.revertedWith(message)
      :
      expect(promise).to.be.reverted;
  }

  describe("Deploy", async () =>
  {
    it("Should mint initial supply to owner", async () =>
    {
      (await expectBalanceOf(owner)).to.equal(totalTokenSupply);
      (await expectTotalSupply()).to.equal(totalTokenSupply);
    });

    it("Should set name and symbol", async () =>
    {
      expect(await TempusToken.name()).to.equal("Tempus");
      expect(await TempusToken.symbol()).to.equal("TEMP");
    });
  });
  
  describe("Burn", async () =>
  {
    it("Should allow users to burn their own tokens", async () =>
    {
      const amount = 10;
      const initialTotalSupply = await TempusToken.totalSupply();

      await transfer(owner, user1, amount); // Owner transfers to User
      (await expectBalanceOf(user1)).to.equal(amount);

      // User tries to burn its own tokens
      await burn(user1, user1, amount);
      (await expectBalanceOf(user1)).to.equal(0);
      (await expectTotalSupply()).to.equal(initialTotalSupply.sub(amount));
    });

    it("Should not allow users to burn other users' tokens", async () =>
    {
      const amount = 10;

      await transfer(owner, user1, amount); // Owner transfers to User
      (await expectBalanceOf(user1)).to.equal(amount);

      // User tries to burn another user's tokens
      // @TODO: add suitable expected error message once it's added to the contract implementation
      await expectRevert(burn(user2, user1, amount));
    });

    it("Should not allow owner to burn users' tokens", async () =>
    {
      const amount = 10;

      await transfer(owner, user1, amount); // Owner transfers to User
      (await expectBalanceOf(user1)).to.equal(amount);

      // Owner burns User, but more than exists
      // @TODO: add suitable expected error message once it's added to the contract implementation
      await expectRevert(burn(owner, user1, 10));
    });
  });
});
