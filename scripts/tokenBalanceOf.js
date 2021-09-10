// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

tokenAddr = "0x06d86063db09F46502354784ADb2af466A92Ec98";
miningAddr = "0xEdc3aBd7B48386f4391Cd1B9755E98B8B8c85c8A";

async function main() {
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.attach(tokenAddr);

  console.log(await token.totalSupply());
  console.log(await token.balanceOf(miningAddr));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
