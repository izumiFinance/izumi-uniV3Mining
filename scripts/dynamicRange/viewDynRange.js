const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 

// example
// HARDHAT_NETWORK='izumiTest' \
//     node viewDynRange.js \
//     'DYNRANGE_WETH9_IZI_3000' 1868
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
  var numNoDecimal = BigNumber(num).times(10 ** decimal);
  return numNoDecimal.toFixed(0);
}

async function getNumDecimal(tokenAddr, num) {
    var token = await attachToken(tokenAddr);
    var decimal = await getDecimal(token);
    var numNoDecimal = BigNumber(num).div(10 ** decimal);
    return numNoDecimal.toFixed(10);
}

async function getMeta(mining) {
    /*
            address token0_,
            address token1_,
            uint24 fee_,
            address iziTokenAddr_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 totalToken0_,
            uint256 totalToken1_,
            uint256 totalNIZI_,
            uint256 startBlock_,
            uint256 endBlock_
    */
  var token0, token1, fee, iziTokenAddr, lastTouchBlock, totalVLiquidity, totalToken0, totalToken1, totalNIZI, startBlock, endBlock;
  [token0, token1, fee, iziTokenAddr, lastTouchBlock, totalVLiquidity, totalToken0, totalToken1, totalNIZI, startBlock, endBlock] = await mining.getMiningContractInfo();
  return {
    token0,
    token1,
    fee,
    totalVLiquidity: totalVLiquidity.toString(),
    totalNIZI: totalNIZI.toString(),
    endBlock: endBlock.toString(),
  }
}
async function getTokenStatus(mining, nftId) {
    /*
        uint256 nftId;
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
        uint256 amount0;
        uint256 amount1;
    */
  var nid, vLiquidity, validVLiquidity, nIZI, lastTouchBlock, amount0, amount1;
  [nid, vLiquidity, validVLiquidity, nIZI, lastTouchBlock, amount0, amount1] = await mining.tokenStatus(nftId);
  return {
    nftId: nid.toString(),
    vLiquidity: vLiquidity.toString(),
    validVLiquidity: validVLiquidity.toString(),
    nIZI: nIZI.toString(),
    lastTouchBlock: lastTouchBlock.toString(),
    amount0: amount0.toString(),
    amount1: amount1.toString()
  };
}
async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoost");
  const mining = Mining.attach(para.miningPoolAddr);


  const [token0Addr, token1Addr] =  await mining.getMiningContractInfo();

  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await mining.rewardInfos(i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfos.push(rewardInfo);
  }

  console.log('rewardInfos: ', rewardInfos);
  let meta = await getMeta(mining);
  console.log('meta: ', meta);

  tokenIds = [para.nftId];
  console.log('token0Addr: ', token0Addr);
  console.log('token1Addr: ', token1Addr);
  const tokenIZiAddr = contracts[net].iZi;
  console.log('iZiAddr: ', tokenIZiAddr);

  while(true) {
    meta = await getMeta(mining);
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
        console.log('token0Amount: ', await getNumDecimal(token0Addr, ts.amount0));
        console.log('token1Amount: ', await getNumDecimal(token1Addr, ts.amount1));
        console.log('iziAmount: ', await getNumDecimal(tokenIZiAddr, ts.nIZI));
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
