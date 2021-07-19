import { task } from 'hardhat/config';

import 'solidity-coverage';
import 'hardhat-gas-reporter';
import 'hardhat-deploy';
import 'hardhat-abi-exporter';
import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";


// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});


/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  typechain: {
    outDir: `./typechain`,
  },
  abiExporter: {
    path: './abi-artifacts',
    clear: false,
    flat: true,
    only: ['TempusToken'],
    spacing: 2
  },
  solidity: {
    version: "0.8.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      // Add dummy accounts here for local development. Connect account to MetaMask using private key.
      accounts: [{
        balance: "10000000000000000000000",
        privateKey: "0x6c6c264916401a7c067c014c61e8c89dba5525e904a6631fd84ccc6e0829f0b3"
      }, {
        balance: "10000000000000000000000",
        privateKey: "0xddb0d7ed4eae780e20fef9bf8d4591b3766526cee8b7307ebb8ea597cd16d066"
      }, {
        balance: "10000000000000000000000",
        privateKey: "0x18728648caa52cc938670482acfdcb9196d002b8c06b902679d7b4429df97ef3"
      }, {
        balance: "10000000000000000000000",
        privateKey: "0x35ed970f932d0e41f4bd7e1e95ca44a0229c73408f9b6f9cf4f949f3699599cc"
      }]
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  },
};
