import { network } from 'hardhat';
import { generateDeployment, waitForContractToBeDeployed, deployContract, promptPrivateKey } from './utils';

const CONTRACT_NAME = "Stats";

async function deploy() {
  const deployerPrivateKey = await promptPrivateKey("Enter deployer Private Key");
  const contract = await deployContract(CONTRACT_NAME, [], deployerPrivateKey);
  await waitForContractToBeDeployed(contract.address);
  await generateDeployment(contract, CONTRACT_NAME, network.name);
}

deploy();
