// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function deployToken(name, symbol, initSupply) {
  
  const Token = await hre.ethers.getContractFactory("Token")
  const token = await Token.deploy(name, symbol, initSupply);
  
  await token.deployed();

  console.log(`${name} deployed to:`, token.address);
  return token;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// deployToken("U Stable Tether", "USDT", "1000000000000")
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });

module.exports = {
  deployToken
}
