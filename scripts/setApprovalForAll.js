const {ethers} = require("hardhat");
const hre = require("hardhat");
const managerJson = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

const managerAddress = "0xC8DA14B7A7145683aE947618ceb3A0005A1E9d65";
const miningAddress = "0xEdc3aBd7B48386f4391Cd1B9755E98B8B8c85c8A";
const address ='0xD4D6F030520649c7375c492D37ceb56571f768D0';


async function setApprovalForAll() {
  const [deployer] = await ethers.getSigners();
  const managerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const manager = await managerContract.attach(managerAddress);
  // const a = await manager.positions(1)
  // console.log(a)
  await manager.setApprovalForAll(miningAddress, true);
  console.log(await manager.isApprovedForAll(address, miningAddress));
  return 0;
}

setApprovalForAll().then(() => process.exit(0)).catch((error) => {console.error(error); process.exit(1);})

