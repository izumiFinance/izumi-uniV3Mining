const { ethers } = require("hardhat");
const hardhat = require("hardhat");
const { ethereum } = require("../deployed.js");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;
var sleep = require('sleep'); 

// example
// HARDHAT_NETWORK='izumiTest' \
//     node mintFixRange.js \
//     'FIXRANGE_BIT_USDC_3000' \
//     0xD4D6F030520649c7375c492D37ceb56571f768D0
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    address: v[3],
}

async function attachToken(address) {
  var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
  var token = tokenFactory.attach(address);
  return token;
}

async function getDecimal(token) {
  var decimal = await token.decimals();
  return decimal;
}

async function getNumNoDecimal(tokenAddr, num) {
  var token = await attachToken(tokenAddr);
  var decimal = await getDecimal(token);
  var numNoDecimal = num * (10 ** decimal);
  return numNoDecimal.toFixed(0);
}

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");

  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  const tokenIds = await mining.getTokenIds(para.address);
  console.log(tokenIds);
  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await mining.rewardInfos(i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfos.push(rewardInfo);
  }
  
  console.log('amountNoDecimal: ', amountNoDecimal);
 
  
  while(true) {
    for (id of tokenIds) {

        const blockNumber = await ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        const blockNumber2 = await ethers.provider.getBlockNumber();
        console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward);
    }
    console.log('---------------------------------');
    sleep.sleep(1);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
