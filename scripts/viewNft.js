const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node viewNft.js 357

const para = {
    nftId: v[2]
}


//mint uniswap v3 nft
async function main() {

  for (var i in para) { console.log("    " + i + ": " + para[i]);}

  //attach to manager
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = await positionManagerContract.attach(managerAddress);

  var nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity;
  var feeGrowthInside0LastX128, feeGrowthInside1LastX128;
  var tokensOwed0, tokensOwed1;

  [
    nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity,
    feeGrowthInside0LastX128, feeGrowthInside1LastX128,
    tokensOwed0, tokensOwed1
  ] = await positionsManager.positions(para.nftId);

  console.log('nonce: ', nonce);
  console.log('operator: ', operator);
  console.log('token0: ', token0);
  console.log('token1: ', token1);


  console.log('tokensOwed0: ', tokensOwed0.toString());
  console.log('tokensOwed1: ', tokensOwed1.toString());

}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
