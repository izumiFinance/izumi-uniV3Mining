const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkEmergencyWithdraw.js \
//     'ONESIDE_WETH9_YIN_3000_EMERGENCY_WITHDRAW' 1913
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
async function getMeta(mining) {
  var uniToken, lockToken, fee, lockBoostMul, iziToken, lastTouchBock, totalVLiquidity, totalLock, totalNIZI, startBlock, endBlock;
  [uniToken, lockToken, fee, lockBoostMul, iziToken, lastTouchBock, totalVLiquidity, totalLock, totalNIZI, startBlock, endBlock] = await mining.getMiningContractInfo();
  return {
    totalVLiquidity: totalVLiquidity.toString(),
    totalNIZI: totalNIZI.toString(),
  }
}
async function getTokenStatus(mining, nftId) {
  var ts = await mining.tokenStatus(nftId);
  return {
    nftId: ts.nftId.toString(),
    vLiquidity: ts.vLiquidity.toString(),
    uniLiquidity: ts.uniLiquidity.toString(),
    nIZI: ts.nIZI.toString(),
    amount0: ts.amount0.toString(),
    amount1: ts.amount1.toString(),
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
        } else if (tokenAddr === contracts[net].WETH9) {
            var b = await hardhat.ethers.provider.getBalance(user.address);
            balance.push(b);
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
  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoostV2");

  console.log('addr: ', para.miningPoolAddr);

  const mining = Mining.attach(para.miningPoolAddr);

  const metaInfo = await mining.getMiningContractInfo();

  console.log('before totalToken0: ', metaInfo.totalToken0_.toString());
  console.log('before totalToken1: ', metaInfo.totalToken1_.toString());
  console.log('before totalNIZI: ', metaInfo.totalNIZI_.toString());
  console.log('before totalVLiquidity: ', metaInfo.totalVLiquidity_.toString());

  var collectTokens = [metaInfo.token0_, metaInfo.token1_, metaInfo.iziTokenAddr_];
  var amountNoDecimal = [
      await getNumNoDecimal(collectTokens[0], 1),
      await getNumNoDecimal(collectTokens[1], 1),
      await getNumNoDecimal(collectTokens[2], 1),
  ];

  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await getRewardInfo(mining, i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      collectTokens.push(rewardInfo.rewardToken);
  }

  console.log('tokens: ', collectTokens);

  tokenIds = [para.nftId];
  var originBalances = await getBalance(tester, collectTokens);
  console.log('origin balance: ', originBalances);
  
    for (id of tokenIds) {

        const ts = await getTokenStatus(mining, id);
        
        console.log('amount0: ', ts.amount0);
        console.log('amount1: ', ts.amount1);
        console.log('nIZI: ', ts.nIZI);
        console.log('vliquidity: ', ts.vLiquidity);

        const blockNumber = await hardhat.ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i + 3]).toFixed(10);
        });
        console.log('reward before collect: ' , reward);

        var tx = await mining.connect(tester).withdraw(id, true);
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
    
  const metaInfoAfter = await mining.getMiningContractInfo();

  console.log('after totalToken0: ', metaInfoAfter.totalToken0_.toString());
  console.log('after totalToken1: ', metaInfoAfter.totalToken1_.toString());
  console.log('after totalNIZI: ', metaInfoAfter.totalNIZI_.toString());
  console.log('after totalVLiquidity: ', metaInfoAfter.totalVLiquidity_.toString());

  console.log('amountNoDecimal: ', amountNoDecimal);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
