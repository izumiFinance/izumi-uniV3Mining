const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkWithdraw.js \
//     'FIXRANGE_USDC_USDT_100' 1466
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

    if (BigNumber(tokenAddr).eq('0')) {
        return '0';
    }
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

    totalFeeCharged0 = await mining.totalFeeCharged0();
    totalFeeCharged1 = await mining.totalFeeCharged1();
  
    var totalNIZI = await mining.totalNIZI();
    totalNIZI = totalNIZI.toString();
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

async function getRewardInfo(mining, idx) {
    var rewardToken, provider, accRewardPerShare, rewardPerBlock;
    [rewardToken, provider, accRewardPerShare, rewardPerBlock] = await mining.rewardInfos(idx);
    return {
        rewardToken: rewardToken,
        provider: provider,
        accRewardPerShare: accRewardPerShare.toString(),
        rewardPerBlock: rewardPerBlock.toString()
    };
}

async function getBalance(user, tokens) {
    balance = [];
    for (var tokenAddr of tokens) {
        console.log('token addr: ', tokenAddr);

        if (BigNumber(tokenAddr).eq('0')) {
          balance.push({_hex:'0x0'});
        } else {
          var token = await attachToken(tokenAddr);
          var b = await token.balanceOf(user.address);
          balance.push(b);
        }
    }
    balance = balance.map((b)=>BigNumber(b._hex));
    return balance;
}

function bigNumberListToStr(b) {
    c = b.map((a)=>a.toFixed(0));
    return c;
}
async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  var meta = await getMiningContractInfo(mining);

  var collectTokens = [meta.iziTokenAddr];
  var amountNoDecimal = [
      await getNumNoDecimal(meta.iziTokenAddr, 1),
  ];

  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await getRewardInfo(mining, i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      collectTokens.push(rewardInfo.rewardToken);
  }

  amountNoDecimal.push(await getNumNoDecimal(meta.token0, 1));
  collectTokens.push(await meta.token0);

  amountNoDecimal.push(await getNumNoDecimal(meta.token1, 1));
  collectTokens.push(await meta.token1);

  console.log('tokens: ', collectTokens);

  tokenIds = [para.nftId];
  var originBalances = await getBalance(tester, collectTokens);
  console.log('origin balance: ', originBalances);

  console.log('before withdraw totalnizi: ', meta.totalNIZI);
  console.log('before withdraw vliquidity: ', meta.totalVLiquidity);
  console.log('total fee charged0: ', meta.totalFeeCharged0);
  console.log('total fee charged1: ', meta.totalFeeCharged1);
  
    for (id of tokenIds) {

        const ts = await getTokenStatus(mining, id);
        console.log('vliquidity: ', ts.vLiquidity);
        console.log('validVliquidity: ', ts.validVLiquidity);
        console.log('nizi: ', BigNumber(ts.nIZI).div(amountNoDecimal[0]).toFixed(10));
        console.log('lastTokensOwed0: ', ts.lastTokensOwed0);
        console.log('lastTokensOwed1: ', ts.lastTokensOwed1);

        const blockNumber = await hardhat.ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i + 1]).toFixed(10);
        });
        console.log('reward before collect: ' , reward);

        var tx = await mining.connect(tester).withdraw(id, false);
        console.log(tx);
        
        const blockNumber2 = await hardhat.ethers.provider.getBlockNumber();

        var currBalance = await getBalance(tester, collectTokens);
        console.log('curr balance: ', currBalance);
        for (var i = 0; i < currBalance.length; i ++) {
            currBalance[i]=currBalance[i].minus(originBalances[i]);
        }
        console.log('delta: ', currBalance);
        console.log('delta: ', bigNumberListToStr(currBalance));
        currBalance = currBalance.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward, ' ', currBalance);
    }
    
  console.log('amountNoDecimal: ', amountNoDecimal);

  meta = await getMiningContractInfo(mining);
  console.log('after withdraw totalnizi: ', meta.totalNIZI);
  console.log('after withdraw vliquidity: ', meta.totalVLiquidity);
  console.log('total fee charged0: ', meta.totalFeeCharged0);
  console.log('total fee charged1: ', meta.totalFeeCharged1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
