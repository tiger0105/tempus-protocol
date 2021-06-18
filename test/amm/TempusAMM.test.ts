import { ethers } from "hardhat";
import { Signer, BigNumber } from "ethers";
import { expect } from "chai";
import { ERC20 } from "../utils/ERC20";
import { ContractBase, SignerOrAddress, addressOf } from "../utils/ContractBase";
import { ERC20OwnerMintable } from "../utils/ERC20OwnerMintable";

describe("Tempus AMM", async () => {
    let ammPool;
    let token1:ERC20OwnerMintable, token2:ERC20OwnerMintable;
    let owner:SignerOrAddress, user:SignerOrAddress;

    beforeEach(async () => {
      [owner, user] = await ethers.getSigners();

      token1 = await ERC20.deployClass(ERC20OwnerMintable, "TestPrincipalShare", "TPS");
      token1.mint(owner, owner, 10000);
      token1.mint(owner, user, 10000);
      token2 = await ERC20.deployClass(ERC20OwnerMintable,"TestYieldShare", "TYS");
      token2.mint(owner, owner, 10000);
      token2.mint(owner, user, 10000);

      const wethMock = await ContractBase.deployContract("WETHMock");
      const authorizer = await ContractBase.deployContract("TempusAuthorizer");

      const vault = await ContractBase.deployContract(
        "TempusVault",
        authorizer.address,
        wethMock.address,
        0,
        0
      );

      const weight1 = ethers.utils.parseUnits("0.95", 18);
      const weight2 = ethers.utils.parseUnits("0.05", 18);
      const swapFeePercentage = ethers.utils.parseUnits("0.01", 18);

      const factory = await ContractBase.deployContract("TempusAMMFactory", vault.address);
      let ammPoolAddress = await factory.create(
        "TempusAMM pool test",
        "TMPAMM",
        [token1.address(), token2.address()],
        [weight1, weight2],
        swapFeePercentage,
        false,
        addressOf(owner)
      );

      ammPool = ContractBase.attachContract("TempusAMM", ammPoolAddress);
    });

    describe("provideLiquidity", async () => {
      // TODO: Add actual tests
    });
});