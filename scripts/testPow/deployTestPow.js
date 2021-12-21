const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployTestPow.js 
const v = process.argv
const net = process.env.HARDHAT_NETWORK

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const TestPow = await hardhat.ethers.getContractFactory("TestPow");
  const testPow = await TestPow.deploy();
  console.log('test pow address: ', testPow.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
