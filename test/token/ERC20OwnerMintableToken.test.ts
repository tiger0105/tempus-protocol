import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

describe("Owner Mintable Token", async () => {
  let owner, user;
  let token;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    let OwnerMintable = await ethers.getContractFactory("ERC20OwnerMintableToken");
    token = await OwnerMintable.connect(owner).deploy("Owner Mintable Test Token", "OTEST");
  });

  function mint(sender, receiver, amount) {
    return token.connect(sender).mint(receiver.address, amount);
  }

  function burn(sender, receiver, amount) {
    return token.connect(sender).burn(receiver.address, amount);
  }

  async function expectBalanceOf(signer): Promise<Chai.Assertion> {
    return expect(await token.balanceOf(signer.address));
  }

  async function expectTotalSupply(): Promise<Chai.Assertion> {
    return expect(await token.totalSupply());
  }

  function expectRevert(promise, message) {
    return expect(promise).to.be.revertedWith(message);
  }

  describe("Deploy", async () =>
  {
    it("Should set the right owner and initial supply", async () =>
    {
      let manager = await token.manager();
      expect(manager).to.equal(owner.address);
      (await expectBalanceOf(owner)).to.equal(0);
      (await expectTotalSupply()).to.equal(0);
    });

    it("Should set name and symbol", async () =>
    {
      expect(await token.name()).to.equal("Owner Mintable Test Token");
      expect(await token.symbol()).to.equal("OTEST");
    });
  });

  describe("Mint", async () =>
  {
    it("Should allow Owner to mint to Owner", async () =>
    {
      // owner mints to himself
      await mint(owner, owner, 10);
      (await expectBalanceOf(owner)).to.equal(10);
      (await expectTotalSupply()).to.equal(10);
    });

    it("Should allow Owner to mint to User", async () =>
    {
      await mint(owner, user, 10); // Owner mints to User
      (await expectBalanceOf(user)).to.equal(10);
      (await expectTotalSupply()).to.equal(10);
    });

    it("Should not allow Users to mint to User", async () =>
    {
      await expectRevert(mint(user, user, 10), "mint: only manager can mint");
    });

    it("Should not allow Users to mint to Owner", async () =>
    {
      await expectRevert(mint(user, owner, 10), "mint: only manager can mint");
    });
  });

  describe("Burn", async () =>
  {
    it("Should allow Owner to burn his own tokens", async () =>
    {
      await mint(owner, owner, 10); // Owner mints to Owner
      (await expectBalanceOf(owner)).to.equal(10);
      (await expectTotalSupply()).to.equal(10);

      await burn(owner, owner, 5); // Owner burns Owner
      (await expectBalanceOf(owner)).to.equal(5);
      (await expectTotalSupply()).to.equal(5);

      await burn(owner, owner, 5);
      (await expectBalanceOf(owner)).to.equal(0);
      (await expectTotalSupply()).to.equal(0);
    });

    it("Should allow Owner to burn User tokens", async () =>
    {
      await mint(owner, user, 8); // Owner mints to User
      (await expectBalanceOf(user)).to.equal(8);
      (await expectTotalSupply()).to.equal(8);

      await burn(owner, user, 8); // Owner burns User
      (await expectBalanceOf(user)).to.equal(0);
      (await expectTotalSupply()).to.equal(0);
    });

    it("Should not allow Users to burn their own tokens", async () =>
    {
      await mint(owner, user, 10); // Owner mints to User
      (await expectBalanceOf(user)).to.equal(10);
      (await expectTotalSupply()).to.equal(10);

      // User tries to burn User tokens
      await expectRevert(burn(user, user, 5), "burn: only manager can burn");
      await expectRevert(burn(user, user, 10), "burn: only manager can burn");
    });

    it("Should not allow Users to burn Owners tokens", async () =>
    {
      await mint(owner, owner, 10); // Owner mints to Owner
      (await expectBalanceOf(owner)).to.equal(10);
      (await expectTotalSupply()).to.equal(10);

      // User tries to burn Owner tokens
      await expectRevert(burn(user, owner, 5), "burn: only manager can burn");
      await expectRevert(burn(user, owner, 10), "burn: only manager can burn");
    });

    it("Should not allow Owner to burn more User tokens than available", async () =>
    {
      await mint(owner, user, 5); // Owner mints to User
      (await expectBalanceOf(user)).to.equal(5);
      (await expectTotalSupply()).to.equal(5);

      // Owner burns User, but more than exists
      await expectRevert(burn(owner, user, 10), "ERC20: burn amount exceeds balance");
    });
  });
});
