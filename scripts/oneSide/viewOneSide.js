const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node viewOneSide.js \
//     'ONESIDE_USDC_BIT_3000' 953
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    nftId: v[3],
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
async function getMeta(mining) {
  var uniToken, lockToken, fee, lockBoostMul, iziToken, lastTouchBock, totalVLiquidity, totalLock, totalNIZI, startBlock, endBlock;
  [uniToken, lockToken, fee, lockBoostMul, iziToken, lastTouchBock, totalVLiquidity, totalLock, totalNIZI, startBlock, endBlock] = await mining.getMiningContractInfo();
  return {
    totalVLiquidity: totalVLiquidity.toString(),
    totalNIZI: totalNIZI.toString(),
    endBlock: endBlock.toString(),
  }
}
async function getTokenStatus(mining, nftId) {
  var nid, uniLiquidity, lockAmount, vLiquidity, validVLiquidity, nIZI, lastTouchBock;
  [nid, uniLiquidity, lockAmount, vLiquidity, validVLiquidity, nIZI, lastTouchBock] = await mining.tokenStatus(nftId);
  return {
    nftId: nid.toString(),
    uniLiquidity: uniLiquidity.toString(),
    lockAmount: lockAmount.toString(),
    vLiquidity: vLiquidity.toString(),
    validVLiquidity: validVLiquidity.toString(),
    nIZI: nIZI.toString(),
    lastTouchBock: lastTouchBock.toString(),
  };
}
async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");
  const mining = await Mining.attach(para.miningPoolAddr);

  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await mining.rewardInfos(i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfos.push(rewardInfo);
  }

  tokenIds = [para.nftId];
  
  while(true) {
    let meta = await getMeta(mining);
    for (id of tokenIds) {

        const blockNumber = await hardhat.ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        let ts = await getTokenStatus(mining, id);
        
        const blockNumber2 = await hardhat.ethers.provider.getBlockNumber();
        console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward, ' valid: ', ts.validVLiquidity, ' totalV: ', meta.totalVLiquidity);
        console.log('vliquidity: ', ts.vLiquidity, ' nizi: ', ts.nIZI, ' totalNizi: ', meta.totalNIZI, ' endblock: ', meta.endBlock);
    }
    console.log('---------------------------------');
    sleep.sleep(1);
  }
  console.log('amountNoDecimal: ', amountNoDecimal);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
