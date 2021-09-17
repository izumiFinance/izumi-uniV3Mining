const {ethers} = require("hardhat");
const hre = require("hardhat");
const managerJson = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    "Deploying contracts with the account:",
    deployer.address
  );
  console.log("Account balance:", (await deployer.getBalance()).toString());
  const managerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);

  const managerAddress = "0xC8DA14B7A7145683aE947618ceb3A0005A1E9d65";
  const manager = await managerContract.attach(managerAddress);
  const USDT = "0x2cc9e757dA9C89d297E78972E60837A2Cf4e8447";
  const USDC = "0xd3B76498DdB2773809A01de45dD42AfDF15B3d5C";
  const DAI = "0xc8e1aDaB59AFF6BF1d25655fa3670bBbf339795C";
  const WETH9 = "0x959a66DF1b53851e9CbdA9C7012cCc211Fb0Dc0A";
  // await manager.createAndInitializePoolIfNecessary(USDT, DAI, 500, 1); 
  console.log(await manager.factory());
  // console.log(tx.hash);
  // console.log(manager.createAndInitializePoolIfNecessary);
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
