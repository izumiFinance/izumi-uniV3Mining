const {ethers} = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const para = {
    target: v[2],
    
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = await positionManagerContract.attach(managerAddress);
  //get uri of target nft
  const uri = await positionsManager.tokenURI(para.target);
  console.log(uri);
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
