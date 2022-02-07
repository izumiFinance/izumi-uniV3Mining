require("@nomiclabs/hardhat-waffle");
require("uniswap-v3-deploy-plugin");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-etherscan");
// require('hardhat-docgen');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const secret = require('./.secret.js');

const apiKey = secret.pkApiKey;
const sk = secret.pk;
const sk2 = secret.pk2;
const sk3 = secret.pk3;
const izumiRpcUrl = "http://47.241.103.6:9545";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },

  networks: {
    izumiTest: {
      url: izumiRpcUrl,
      gas: 8000000,
      gasPrice: 20000000000,
      accounts: [sk, sk2, sk3]
    },
    arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
      accounts: [sk]
    },
    polygon: {
      gas: 8000000,
      gasPrice: 290000000000,
      url: 'https://rpc-mainnet.maticvigil.com',
      accounts: [sk]
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      gas: 10000000,
      gasPrice: 2500000000,
      accounts: [sk]
    },
    ethereum: {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      gas: 7792207,
      gasPrice: 77000000000,
      accounts: [sk]
    },
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: apiKey,
  }
};
