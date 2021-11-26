import { network } from 'hardhat';
import { generateDeployment, deployContract, promptPrivateKey, waitForContractToBeDeployed } from './utils';

const CONTRACT_NAME = "TempusController";

async function deploy() {
  const deployerPrivateKey = await promptPrivateKey("Enter deployer Private Key");
  const contract = await deployContract(CONTRACT_NAME, [], deployerPrivateKey);
  await waitForContractToBeDeployed(contract.address);
  await generateDeployment(contract, CONTRACT_NAME, network.name);
}

deploy();
