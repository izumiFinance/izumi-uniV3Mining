// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const DAI = await hre.ethers.getContractFactory("Token")
  const dai = await DAI.deploy("Dai Stable Coin", "DAI");
  
  await dai.deployed();

  console.log("DAI deployed to:", dai.address);
  
  const USDT = await hre.ethers.getContractFactory("Token")
  const usdt = await USDT.deploy("USD Tether", "USDT");
  await usdt.deployed();
  console.log("USDT deployed to:", usdt.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
