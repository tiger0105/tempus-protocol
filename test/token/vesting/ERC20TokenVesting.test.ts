import { ethers } from "hardhat";
import { expect } from "chai";
import { addressOf, Signer } from "../../utils/ContractBase";
import { blockTimestamp, expectRevert, increaseTime } from "../../utils/Utils";
import { ERC20OwnerMintable } from "../../utils/ERC20OwnerMintable";
import { ERC20Vesting, VestingTerms } from "../../utils/ERC20Vesting";

describe("ERC20 Vesting", async () => {
  let owner:Signer, user:Signer;
  let token:ERC20OwnerMintable;
  let vesting:ERC20Vesting;
  const DAY = 60*60*24;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    token = await ERC20OwnerMintable.create("ERC20OwnerMintableToken", "Owner Mintable Test Token", "OTEST");
    await token.mint(owner, owner, 300);
    vesting = await ERC20Vesting.create(token, owner);
  });

  describe("Deploy", async () => {
    it("Should set the right wallet and token address", async () => {
      expect(await vesting.wallet()).to.equal(addressOf(owner));
      expect(await vesting.token()).to.equal(token.address);
    });
  });

  describe("Invalid inputs", async () => {
    it("startVesting reverts on input", async () => {
      const startTime = await blockTimestamp();
      const period = DAY * 30;
      (await expectRevert(vesting.startVesting(
        owner,
        "0x0000000000000000000000000000000000000000",
        {startTime: 0, period: period, amount: 30, claimed: 0}
      ))).to.equal("Receiver cannot be 0.");

      (await expectRevert(vesting.startVesting(
        owner,
        user,
        {startTime: 0, period: period, amount: 30, claimed: 0}
      ))).to.equal("Start time must be set.");

      (await expectRevert(vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: 0, amount: 30, claimed: 0}
      ))).to.equal("Period must be set.");

      (await expectRevert(vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 0, claimed: 0}
      ))).to.equal("Amount must be > 0.");

      (await expectRevert(vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 1}
      ))).to.equal("Can not start vesting with already claimed tokens.");

      await vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      );

      (await expectRevert(vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      ))).to.equal("Vesting already started for account.");
    });

    it("stopVesting only callable by wallet", async () => {
      (await expectRevert(vesting.stopVesting(user,user))).to.equal("Only wallet is allowed to proceed");
    });

    it("stopVesting invalid inputs", async () => {
      (await expectRevert(vesting.stopVesting(owner,"0x0000000000000000000000000000000000000000"))).to.equal("Receiver cannot be 0.");
    });

    it("claim reverts on input", async () => {
      (await expectRevert(vesting.claim(user, "0x0000000000000000000000000000000000000000", 1))).to.equal("Receiver cannot be 0.");
      (await expectRevert(vesting.claim(user, user, 0))).to.equal("Claiming 0 tokens.");
      (await expectRevert(vesting.claim(user, user, 10))).to.equal("No vesting data for sender.");

      await vesting.startVesting(
        owner,
        user,
        {startTime: await blockTimestamp(), period: DAY * 30, amount: 30, claimed: 0}
      );

      (await expectRevert(vesting.claim(user, user, 100))).to.equal("Claiming amount exceeds allowed tokens.");
    });
  });

  describe("Check vesting", async () => {
    it("Expected state after startVesting", async () => {
      const startTime = await blockTimestamp();
      const period = DAY * 30;
      await vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      );

      const terms:VestingTerms = await vesting.getVestingTerms(user);
      expect(terms.amount).to.equal(30);
      expect(terms.startTime).to.equal(startTime);
      expect(terms.period).to.equal(period);
      expect(terms.claimed).to.equal(0);

      expect(await token.balanceOf(owner)).to.equal(270);
    });

    it("Expected state after stopVesting", async () => {
      const startTime = await blockTimestamp();
      const period = DAY * 30;
      await vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      );
      await vesting.stopVesting(owner, user);
  
      const terms:VestingTerms = await vesting.getVestingTerms(user);
      expect(terms.amount).to.equal(0);
      expect(terms.startTime).to.equal(0);
      expect(terms.period).to.equal(0);
      expect(terms.claimed).to.equal(0);

      expect(await vesting.claimable(user)).to.equal(0);

      expect(await token.balanceOf(owner)).to.equal(300);
    });

    it("claiming after period finished", async () => {
      const startTime = await blockTimestamp();
      const period = DAY;
      await vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      );

      await increaseTime(period * 2);
      await vesting.claim(user, user, await vesting.claimable(user));
      expect(await token.balanceOf(user)).to.equal(30);
    });

    it("claiming after half period", async () => {
      const startTime = await blockTimestamp();
      const period = DAY;
      await vesting.startVesting(
        owner,
        user,
        {startTime: startTime, period: period, amount: 30, claimed: 0}
      );
  
      await increaseTime(period / 2);
      await vesting.claim(user, user, await vesting.claimable(user));
      expect(+await token.balanceOf(user)).to.be.within(15, 15.1);
    });
  });

});