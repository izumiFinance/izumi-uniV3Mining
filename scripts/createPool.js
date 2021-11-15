const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],
    priceSqrtX96: v[5],
}

async function main() {
  // We get the signer's info
  const [deployer] = await hardhat.ethers.getSigners();
  console.log("Creating pool with the account:",
    deployer.address)
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const managerContract = await hardhat.ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const manager = await managerContract.attach(managerAddress);

  //Check whether attach successfully
  console.log(await manager.factory(), "attach successfully");
  //If there is no pool or pool not inited with token0 & token1, create and init one
  const tx = await manager.createAndInitializePoolIfNecessary(para.token0Address, para.token1Address, para.fee, para.priceSqrtX96);
  console.log(tx.hash);
  console.log("Create pool successfully!");
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
