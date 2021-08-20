import { ethers } from "hardhat";
import { utils } from "ethers";
import { Transaction } from "ethers";
import { expect } from "chai";
import { ContractBase } from "./utils/ContractBase";
import { Aave } from "./utils/Aave";
import { Comptroller } from "./utils/Comptroller";
import { Lido } from "./utils/Lido";
import { blockTimestamp, expectRevert } from "./utils/Utils";
import { toWei } from "./utils/Decimal";

describe("Tempus controller deployment via factory tests", async () => {
  let tempusController;
  let owner;

  beforeEach("", async () => {
    [owner] = await ethers.getSigners();
    tempusController = await ContractBase.deployContract("TempusController");
  });

  it("Revert on zero factory", async () => {
    const aaveTempusFactory = await ContractBase.deployContract("AaveTempusPoolFactory");
    await tempusController.connect(owner).addFactory(aaveTempusFactory.address);
    const underlyingProtocol = await Aave.create(100000000);

    let deployPoolTransaction:Promise<Transaction> = tempusController.connect(owner).deployTempusPool(
        utils.formatBytes32String("Yearn"),
        underlyingProtocol.yieldToken.address,
        await blockTimestamp() + 60 * 60,
        toWei(0.1),
        "TPS",
        "TPS",
        "TYS",
        "TYS"
    );
    (await expectRevert(deployPoolTransaction)).to.be.equal("Protocol not supported!");
  });

  it("Register Aave pool factory and deploy pool", async () => {
    const aaveTempusFactory = await ContractBase.deployContract("AaveTempusPoolFactory");
    await tempusController.connect(owner).addFactory(aaveTempusFactory.address);
    const underlyingProtocol = await Aave.create(100000000);

    const deployPoolTransaction = tempusController.connect(owner).deployTempusPool(
        utils.formatBytes32String("Aave"),
        underlyingProtocol.yieldToken.address,
        await blockTimestamp() + 60*60,
        toWei(0.1),
        "TPS",
        "TPS",
        "TYS",
        "TYS"
    );

    await expect(deployPoolTransaction).to.emit(tempusController, "TempusPoolDeployed");
  });

  it("Register Compound pool factory and deploy pool", async () => {
    const compTempusFactory = await ContractBase.deployContract("CompoundTempusPoolFactory");
    await tempusController.connect(owner).addFactory(compTempusFactory.address);
    const underlyingProtocol = await Comptroller.create(100000000);

    const deployPoolTransaction = tempusController.connect(owner).deployTempusPool(
        utils.formatBytes32String("Compound"),
        underlyingProtocol.yieldToken.address,
        await blockTimestamp() + 60*60,
        toWei(0.1),
        "TPS",
        "TPS",
        "TYS",
        "TYS"
    );

    await expect(deployPoolTransaction).to.emit(tempusController, "TempusPoolDeployed");
  });

  it("Register Lido pool factory and deploy pool", async () => {
    const lidoTempusFactory = await ContractBase.deployContract("LidoTempusPoolFactory");
    await tempusController.connect(owner).addFactory(lidoTempusFactory.address);
    const underlyingProtocol = await Lido.create(100000000);

    const deployPoolTransaction = tempusController.connect(owner).deployTempusPool(
        utils.formatBytes32String("Lido"),
        underlyingProtocol.yieldToken.address,
        await blockTimestamp() + 60*60,
        toWei(0.1),
        "TPS",
        "TPS",
        "TYS",
        "TYS"
    );
    await expect(deployPoolTransaction).to.emit(tempusController, "TempusPoolDeployed");
  });
});