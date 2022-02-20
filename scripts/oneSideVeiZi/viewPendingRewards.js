const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 
const { ethers } = require("hardhat");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node tryWithdraw.js \
//     'ONESIDE_VEIZI_USDC_IZI_3000' 1905
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK

const weth = contracts[net].WETH9
const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
  const mining = await Mining.attach(para.miningPoolAddr);

  let tokenIds = await mining.getTokenIds(tester.address);
  tokenIds = tokenIds.map((t)=>t.toString())
  console.log('tokenids: ', tokenIds);

  const userStatus = await mining.userStatus(tester.address);
  console.log('user status: ', userStatus);
  console.log('vliquidity: ', userStatus.vLiquidity.toString());

  const totalVLiquidity = await mining.totalVLiquidity();
  console.log('total vliquidity: ', totalVLiquidity.toString());

  const tokenPendingReward = await mining.pendingReward(tokenIds[0]);
  console.log('token pending reward: ', tokenPendingReward);

//   const userPendingRewards = await mining.pendingRewards(tester.address);
//   console.log('user pending rewards: ', userPendingRewards);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
