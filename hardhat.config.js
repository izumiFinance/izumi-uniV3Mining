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
    test: {
      url: "http://0.0.0.0:9545",
      accounts: ['00792d92886534d8153df0b5325ba974ba2af41736379ebba455208d5ac1f37a']
    }
  }
};
