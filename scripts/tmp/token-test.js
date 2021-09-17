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
  const Token = await hre.ethers.getContractFactory("Token");
  const weth9 = await Token.attach("0x959a66DF1b53851e9CbdA9C7012cCc211Fb0Dc0A");

  console.log(await weth9.totalSupply());
  console.log(await weth9.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0'));
  console.log(await weth9.deposit({value: 1000000000000000000}));
  console.log(await weth9.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0'));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
