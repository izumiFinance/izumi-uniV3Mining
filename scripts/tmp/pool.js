const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

async function main() {
  // We get the signer's info
  const [deployer] = await hardhat.ethers.getSigners();
  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  const managerContract = await hardhat.ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);

  const manager = await managerContract.attach(managerAddress);
  
  //Test whether attach successfully
  console.log(await manager.factory(), "attach successfully");
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
