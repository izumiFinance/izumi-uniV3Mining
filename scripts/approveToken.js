const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node approveToken.js 'BIT' '0x9a807F7aaBbc502b11434e069187Df8E78c0a599'

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    approveAddress: v[3],
}


//mint uniswap v3 nft
async function main() {

  console.log("Approve token: ")
  for (var i in para) { console.log("    " + i + ": " + para[i]);}

  //attach to manager
  const [deployer] = await ethers.getSigners();
      
  const tokenContract = await hre.ethers.getContractFactory("Token");



  const token0Contract = await tokenContract.attach(para.token0Address);
  await token0Contract.approve(para.approveAddress, '1000000000000000000000000000000'); //10**30
  console.log("	" + await token0Contract.allowance(deployer.address, para.approveAddress));
  

}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
