require("@nomiclabs/hardhat-waffle");
require("uniswap-v3-deploy-plugin");

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

const sk = secret.sk;
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
    izumi_test: {
      url: izumiRpcUrl,
      gas: 8000000,
      gasPrice: 2000000000,
      accounts: [sk]
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      gas: 10000000,
      gasPrice: 200000000,
      accounts: [sk]
    }
  }
};
