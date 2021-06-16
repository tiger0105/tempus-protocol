import { ethers } from "hardhat";
import { BigNumber, utils } from "ethers";
import { expect } from "chai";
import * as util from "../../ERC20";

describe("Lido Mock", async () => {
  let owner, user;
  let lido:LidoMock;

  class LidoMock extends util.ERC20 {
    async sharesOf(signerOrAddress) {
      let address = util.addressOf(signerOrAddress);
      return util.toEth(await this.contract.sharesOf(address));
    }
    async getTotalShares() {
      return util.toEth(await this.contract.getTotalShares());
    }
    async submit(signer, etherAmount:Number) {
      let wei = util.toWei(etherAmount); // payable call, set msg.value in wei
      return await this.connect(signer).submit(signer.address, {value: wei})
    }
    async depositBufferedEther() {
      // ethers.js does not resolve overloads, so need to call the function by string lookup
      return await this.contract["depositBufferedEther()"]();
    }
    async depositBufferedEther2(maxDeposits:number) {
      return await this.contract["depositBufferedEther(uint256)"](maxDeposits);
    }
    /**
     * Updates the contract with information from ETH2 orcale
     * Calculates rewards using formulae:  rewards = balance - 32*validators
     * @param validators Total number of ACTUAL 32xETH deposits made during deposit event.
     *                   This could be different than # of depositBufferedEther(1) calls.
     * @param balance Actual balance in the ETH2 oracle
     */
    async pushBeacon(validators:number, balance:number) {
      return await this.connect(owner).pushBeacon(validators, util.toWei(balance));
    }
    // pushes balance to achieve certain amount of `totalRewards`
    async pushBeaconRewards(validators:number, rewards:number) {
      // push X eth reward, rewards = balance - 32*validators
      let balance = rewards + 32*validators;
      return await this.pushBeacon(validators, balance);
    }
    async withdraw(signer, shareAmount:Number) {
      // We ignore the pubKeyHash.
      return await this.connect(signer).withdraw(util.toWei(shareAmount), ethers.utils.formatBytes32String(""));
    }
    async printState(title) {
      console.log("State:", title);
      console.log("  totalSupply:", await lido.totalSupply());
      console.log("  totalShares:", await lido.getTotalShares());
      console.log("  owner.shares: ", await lido.sharesOf(owner));
      console.log("  owner.balance:", await lido.balanceOf(owner));
      console.log("  user.shares: ", await lido.sharesOf(user));
      console.log("  user.balance:", await lido.balanceOf(user));
    }
  }

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();
    lido = new LidoMock(await util.deploy("LidoMock"));
  });

  describe("Submit", async () =>
  {
    it("Should store and track balance similar to ERC20 tokens BEFORE buffer deposit", async () =>
    {
      await lido.sendToContract(owner, 4.0); // join Lido
      await lido.submit(user, 2.0); // join Lido

      expect(await lido.totalSupply()).to.equal(6.0); // alias to getTotalPooledEther()
      expect(await lido.getTotalShares()).to.equal(6.0);

      expect(await lido.balanceOf(owner)).to.equal(4.0);
      expect(await lido.balanceOf(user)).to.equal(2.0);

      expect(await lido.sharesOf(owner)).to.equal(4.0);
      expect(await lido.sharesOf(user)).to.equal(2.0);
    });

    it("Should reject ZERO deposit", async () =>
    {
      (await util.revert(lido.submit(user, 0.0))).to.equal("ZERO_DEPOSIT");
    });

    it("Should deposit in 32eth chunks", async () =>
    {
      await lido.submit(owner, 8.0);
      await lido.depositBufferedEther2(1);
      expect(await lido.totalSupply()).to.equal(8.0);
      expect(await lido.sharesOf(owner)).to.equal(8.0);
      
      await lido.submit(owner, 32.0);
      await lido.depositBufferedEther();
      expect(await lido.totalSupply()).to.equal(40.0);
      expect(await lido.sharesOf(owner)).to.equal(40.0);
    });

    it("Should increase account balances after rewards in fixed proportion", async () =>
    {
      let initial = 50.0;
      await lido.submit(owner, initial*0.2);
      await lido.submit(user, initial*0.8);
      await lido.depositBufferedEther();

      let rewards = 1.0;
      let minted = 0.098231827111984282;
      await lido.pushBeaconRewards(1, rewards);
      await lido.printState("after pushBeaconRewards (1 eth)");

      expect(await lido.totalSupply()).to.equal(initial + rewards);
      expect(await lido.getTotalShares()).to.equal(initial + minted);

      let ownerBalance = await lido.balanceOf(owner);
      let userBalance  = await lido.balanceOf(user);
      expect(ownerBalance).to.equal(10.18);
      expect(userBalance).to.equal(40.72);

      // TODO: Check if owner and user received accurate amount of new balance
      let added = ownerBalance.valueOf() + userBalance.valueOf() - initial;
      console.log("minted: ", minted);
      console.log("added balances: ", added);
      console.log("added + minted: ", added+minted);
    });
  });

  describe("Withdraw", async () =>
  {
    it("Should be allowed to withdraw original deposit", async () =>
    {
      await lido.submit(owner, 32.0);
      await lido.depositBufferedEther();
      await lido.submit(user, 33.0);
      await lido.submit(user, 33.0);

      // Three validators and total balance of 34, i.e accrued 2 eth of yield
      await lido.pushBeacon(1, 34.0);
      expect(await lido.sharesOf(owner)).to.equal(32.0);
      expect(await lido.sharesOf(user)).to.equal(66.0);

      // Withdraw some ether
      await lido.withdraw(owner, 32.0);
      expect(await lido.sharesOf(owner)).to.equal(0.0);
      expect(await lido.sharesOf(user)).to.equal(66.0);

      (await util.revert(lido.withdraw(owner, 100.0)))
        .to.equal("Can only withdraw up to the buffered ether.");

      (await util.revert(lido.withdraw(owner, 1.0)))
        .to.equal("BURN_AMOUNT_EXCEEDS_BALANCE");
    });
  });
});
