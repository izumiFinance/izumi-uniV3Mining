const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node approveToken.js 'BIT'

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    airdropAddress: contracts[net]['AIRDROP']
}


//mint uniswap v3 nft
async function main() {

  console.log("Approve token: ")
  for (var i in para) { console.log("    " + i + ": " + para[i]);}

  //attach to manager
  const [deployer] = await ethers.getSigners();
      
  const Airdrop = await hre.ethers.getContractFactory("Airdrop");

  const airdrop = Airdrop.attach(para.airdropAddress);
  
  await airdrop.setProvider(para.token0Address, deployer.address);
  
  const tokenContract = await hre.ethers.getContractFactory("Token");

  const token0Contract = await tokenContract.attach(para.token0Address);
  await token0Contract.approve(para.airdropAddress, '1000000000000000000000000000000'); 
  console.log("addr: " + deployer.address);
  console.log("contract: ", para.airdropAddress);
  console.log("	" + await token0Contract.allowance(deployer.address, para.airdropAddress));

}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
