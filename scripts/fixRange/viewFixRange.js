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
//     'FIXRANGE_USDC_USDT_100' \
//     1466
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

async function getTokenStatus(mining, nftId) {


  // uint256 vLiquidity;
  // uint256 validVLiquidity;
  // uint256 nIZI;
  // uint256 lastTouchBlock;
  var vLiquidity, validVLiquidity, nIZI, lastTouchBlock;

  [vLiquidity, validVLiquidity, nIZI, lastTouchBlock, lastTokensOwed0, lastTokensOwed1] = await mining.tokenStatus(nftId);
  vLiquidity = vLiquidity.toString();
  validVLiquidity = validVLiquidity.toString();
  nIZI = nIZI.toString();
  lastTouchBlock = lastTouchBlock.toString();
  lastTokensOwed0 = lastTokensOwed0.toString();
  lastTokensOwed1 = lastTokensOwed1.toString();
  return {
    vLiquidity,
    validVLiquidity,
    nIZI,
    lastTouchBlock,
    lastTokensOwed1,
    lastTokensOwed0
  };
}

async function getMiningContractInfo(mining) {
  var token0, token1, fee, rewardInfos, iziTokenAddr, rewardUpperTick, rewardLowerTick, lastTouchBlock, totalVLiquidity, startBlock, endBlock;
  [token0, token1, fee, rewardInfos, iziTokenAddr, rewardUpperTick, rewardLowerTick, lastTouchBlock, totalVLiquidity, startBlock, endBlock] = await mining.getMiningContractInfo();
  lastTouchBlock = lastTouchBlock.toString();
  totalVLiquidity = totalVLiquidity.toString();
  startBlock = startBlock.toString();
  endBlock = endBlock.toString();

  var totalNIZI = await mining.totalNIZI();
  totalNIZI = totalNIZI.toString();

  var totalFeeCharged0 = await mining.totalFeeCharged0();
  var totalFeeCharged1 = await mining.totalFeeCharged1();
  return {
      token0,
      token1,
      fee,
      totalNIZI,
      // rewardInfos,
      iziTokenAddr,
      rewardLowerTick,
      rewardUpperTick,
      lastTouchBlock,
      totalVLiquidity,
      startBlock,
      endBlock,
      totalFeeCharged0: totalFeeCharged0.toString(),
      totalFeeCharged1: totalFeeCharged1.toString(),
  };
}
async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");

  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  const tokenIds = [para.nftId];
  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await mining.rewardInfos(i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfo.rewardPerBlock = rewardInfo.rewardPerBlock.toString();
      rewardInfos.push(rewardInfo);
  }
  
  console.log('amountNoDecimal: ', amountNoDecimal);
  console.log('rewardToken: ', rewardInfos[0].rewardToken);
  console.log('rewardProvider: ', rewardInfos[0].provider);

  console.log('rewardInfos: ', rewardInfos);
  let meta = await getMiningContractInfo(mining);
  console.log('meta: ', meta);

  
  while(true) {
    meta = await getMiningContractInfo(mining);
    for (id of tokenIds) {

        const blockNumber = await ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        let ts = await getTokenStatus(mining, id);
        const blockNumber2 = await ethers.provider.getBlockNumber();
        console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward, ' valid: ', ts.validVLiquidity, ' totalV: ', meta.totalVLiquidity);
        console.log('vliquidity: ', ts.vLiquidity, ' nizi: ', ts.nIZI, ' totalNizi: ', meta.totalNIZI, ' endblock: ', meta.endBlock, ' startBlock: ', meta.startBlock);
        console.log('lastTokensOwed0: ', ts.lastTokensOwed0, ' lastTokensOwed1: ', ts.lastTokensOwed1);
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
