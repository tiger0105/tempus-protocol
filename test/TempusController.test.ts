import { deployments, ethers } from "hardhat";
import { expect } from "chai";
import { ONE_WEI, toWei } from "./utils/Decimal";
import { TempusAMM, TempusAMMJoinKind } from "./utils/TempusAMM";
import { ContractBase } from "./utils/ContractBase";
import { blockTimestamp, expectRevert } from "./utils/Utils";
import { Aave } from "./utils/Aave";
import { generateTempusSharesNames, TempusPool } from "./utils/TempusPool";
import { Lido } from "./utils/Lido";

const SWAP_LIMIT_ERROR_MESSAGE = "BAL#507";

const _setup = underlyingProtocolSetup => (deployments.createFixture(async () => {
  await deployments.fixture(undefined, {
    keepExistingDeployments: true, // global option to test network like that
  });

  const ammAmplification = 5;
  const ammFee = 0.02;

  const [owner, user] = await ethers.getSigners();

  const { underlyingProtocol, underlyingProtocol1, tempusPool, tempusPool1 } = await underlyingProtocolSetup(owner, user);
  
  const tempusAMM = await TempusAMM.create(owner, ammAmplification, ammFee, tempusPool);
  
  const tempusController = await ContractBase.deployContract('TempusController');
  await underlyingProtocol.yieldToken.approve(owner, tempusController.address, 1000000);
  await underlyingProtocol.yieldToken.approve(user, tempusController.address, 1000000);
  await underlyingProtocol.asset.approve(owner, tempusController.address, 10000000);
  await underlyingProtocol.asset.approve(user, tempusController.address, 1000000);

  return {
    contracts: {
      underlyingProtocol, 
      underlyingProtocol1,
      tempusPool,
      tempusPool1,
      tempusAMM,
      tempusController
    },
    signers: {
      owner,
      user
    }
  };
}));

const setupAave = _setup(async (owner, user) => {
  const underlyingProtocol = await Aave.create(100000000);
  const underlyingProtocol1 = await Aave.create(100000000);

  for (const underlyingP of [underlyingProtocol, underlyingProtocol1]) {
    await underlyingP.asset.transfer(owner, user, 10000000);
    await underlyingP.asset.approve(owner, underlyingP.address, 10000000);
    await underlyingP.asset.approve(user, underlyingP.address, 1000000);
    await underlyingP.deposit(owner, 1000000);
    await underlyingP.deposit(user, 1000000);
  }

  const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
  const names = generateTempusSharesNames("aToken", "aTKN", maturityTime);
  const tempusPool = await TempusPool.deployAave(underlyingProtocol.yieldToken, maturityTime, 0.1, names);
  const tempusPool1 = await TempusPool.deployAave(underlyingProtocol1.yieldToken, maturityTime, 0.1, names);

  return { underlyingProtocol, underlyingProtocol1, tempusPool, tempusPool1 };
});

const setupLido = _setup(async (owner, user) => {
  const underlyingProtocol = await Lido.create(1000000);
  const underlyingProtocol1 = await Lido.create(1000000);
  
  for (const underlyingP of [underlyingProtocol, underlyingProtocol1]) {
    await underlyingP.submit(owner, 1000);
    await underlyingP.submit(user, 1000);
  }

  const maturityTime = await blockTimestamp() + 60*60; // maturity is in 1hr
  const names = generateTempusSharesNames("Lido staked token", "stTKN", maturityTime);
  const tempusPool = await TempusPool.deployLido(underlyingProtocol.yieldToken, maturityTime, 0.1, names);
  const tempusPool1 = await TempusPool.deployLido(underlyingProtocol1.yieldToken, maturityTime, 0.1, names);

  return { tempusPool, tempusPool1, underlyingProtocol, underlyingProtocol1 };
});

  
async function expectValidState(tempusController, tempusAMM, tempusPool, expectedAMMBalancesRatio = null) {
  const controllerPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusController.address);
  const controllerYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusController.address);
  
  if (expectedAMMBalancesRatio) {
    const vaultPrincipalShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
    const vaultYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
    const postDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePostDeposit)).div(toWei(vaultYieldShareBalancePostDeposit));
    
    // Makes sure AMM balances maintain the same ratio
    expect(postDepositAMMBalancesRatio.toString()).to.equal(expectedAMMBalancesRatio.toString());
  }

  // makes sure no funds are left in the controller
  expect(controllerPrincpialShareBalancePostDeposit).to.be.equal(0);
  expect(controllerYieldShareBalancePostDeposit).to.be.equal(0);
}

describe("TempusController", async () => {
    // TODO: refactor math (minimize toWei, fromWei, Number etc...). I think we should just use Decimal.js
    describe("depositAndProvideLiquidity", async () => {
      it("deposit YBT and provide liquidity to a pre-initialized AMM", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 1234.5678912, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(5234.456789),
            false
        ); 
        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool, preDepositAMMBalancesRatio);
        
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });

      it("deposit ERC20 BT and provide liquidity to a pre-initialized AMM", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 123.45678912, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(5234.456789),
            true
        ); 
        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool, preDepositAMMBalancesRatio);
        
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });

      it("deposit ETH BT and provide liquidity to a pre-initialized AMM", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupLido();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);
        
        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 100, owner);
        await tempusAMM.provideLiquidity(owner, 1.234567, 12.345678912, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(52.456789),
            true,
            { value: toWei(52.456789) }
        );
        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool, preDepositAMMBalancesRatio);
        
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });

      it("deposit YBT and provide liquidity to a pre-initialized AMM with more then 100% yield estimate", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();

        const userPoolTokensBalancePreDeposit = await tempusAMM.balanceOf(user);
        expect(Number(userPoolTokensBalancePreDeposit)).to.be.equal(0);

        underlyingProtocol.setLiquidityIndex(10.0);

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 123.45678, 1.2345678, TempusAMMJoinKind.INIT);
        
        const vaultPrincipalShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(tempusAMM.vault.address);
        const vaultYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(tempusAMM.vault.address);
        const preDepositAMMBalancesRatio = ONE_WEI.mul(toWei(vaultPrincipalShareBalancePreDeposit)).div(toWei(vaultYieldShareBalancePreDeposit));
        
        await tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(5234.456789),
            false
        ); 
        const userPoolTokensBalancePostDeposit = await tempusAMM.balanceOf(user);
        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool, preDepositAMMBalancesRatio);
        // Makes sure some pool tokens have been issued to the user
        expect(Number(userPoolTokensBalancePostDeposit)).to.be.greaterThan(0);

        // all TYS balance should be deposited into the AMM, and some TPS sent back to the user
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.greaterThan(0);
      });

      it("verifies depositing YBT and providing liquidity to a non initialized AMM reverts", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        
        const invalidAction = tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(123),
            false
        );
        (await expectRevert(invalidAction)).to.equal("AMM not initialized");
      });

      it("verifies depositing ERC20 BT and providing liquidity to a non initialized AMM reverts", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        
        const invalidAction = tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            toWei(123),
            true
        );
        (await expectRevert(invalidAction)).to.equal("AMM not initialized");
      });

      it("verifies depositing 0 YBT and providing liquidity reverts", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 12.34567, 1234.5678912, TempusAMMJoinKind.INIT);
        
        const invalidAction = tempusController.connect(user).depositAndProvideLiquidity(
            tempusAMM.address,
            0,
            false
        );
        (await expectRevert(invalidAction)).to.equal("yieldTokenAmount is 0");
      });
    });

    describe("depositAndFix", async () => {
      it("verifies tx reverts if provided minimum TYS rate requirement is not met", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        const minTYSRate = toWei("0.11000001"); // 10.000001%

        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 200, 2000, TempusAMMJoinKind.INIT); // 10% rate
  
        const invalidAction = tempusController.connect(user).depositAndFix(
            tempusAMM.address,
            toWei(5.456789),
            false,
            minTYSRate
        ); 
  
        (await expectRevert(invalidAction)).to.equal(SWAP_LIMIT_ERROR_MESSAGE);
      });

      it("verifies depositing YBT succeeds if provided minimum TYS rate requirement is met", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        const minTYSRate = toWei("0.097"); // 9.7% (fee + slippage)
        
        const userPrincpialShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(user);
        expect(Number(userPrincpialShareBalancePreDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePreDeposit)).to.be.equal(0);
        
        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 200, 2000, TempusAMMJoinKind.INIT); // 10% rate
  
        await tempusController.connect(user).depositAndFix(
            tempusAMM.address,
            toWei(5.456789),
            false,
            minTYSRate
        ); 

        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool);
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });

      it("verifies depositing ERC20 BT succeeds if provided minimum TYS rate requirement is met", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupAave();
        const minTYSRate = toWei("0.097"); // 9.7% (fee + slippage)
        
        const userPrincpialShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(user);
        expect(Number(userPrincpialShareBalancePreDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePreDeposit)).to.be.equal(0);
        
        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 10000, owner);
        await tempusAMM.provideLiquidity(owner, 200, 2000, TempusAMMJoinKind.INIT); // 10% rate
  
        await tempusController.connect(user).depositAndFix(
            tempusAMM.address,
            toWei(5.456789),
            true,
            minTYSRate
        ); 

        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool);
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });

      it("verifies depositing ETH BT succeeds if provided minimum TYS rate requirement is met", async () => {
        const { contracts: { underlyingProtocol, tempusAMM, tempusController, tempusPool, tempusPool1 }, signers: { owner, user } } = await setupLido();
        const minTYSRate = toWei("0.097"); // 9.7% (fee + slippage)
        
        const userPrincpialShareBalancePreDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePreDeposit = await tempusPool.yieldShare.balanceOf(user);
        expect(Number(userPrincpialShareBalancePreDeposit)).to.be.equal(0);
        expect(Number(userYieldShareBalancePreDeposit)).to.be.equal(0);
        
        // pre-initialize AMM liquidity
        await tempusPool.deposit(owner, 1000, owner);
        await tempusAMM.provideLiquidity(owner, 20, 200, TempusAMMJoinKind.INIT); // 10% rate
  
        await tempusController.connect(user).depositAndFix(
            tempusAMM.address,
            toWei(5.456789),
            true,
            minTYSRate,
            { value: toWei(5.456789) }
        ); 

        const userPrincpialShareBalancePostDeposit = await tempusPool.principalShare.balanceOf(user);
        const userYieldShareBalancePostDeposit = await tempusPool.yieldShare.balanceOf(user);
        
        await expectValidState(tempusController, tempusAMM, tempusPool);
        expect(Number(userPrincpialShareBalancePostDeposit)).to.be.greaterThan(0);
        expect(Number(userYieldShareBalancePostDeposit)).to.be.equal(0);
      });
    });
});
