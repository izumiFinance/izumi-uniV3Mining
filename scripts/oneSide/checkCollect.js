const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 
const config = require("../../hardhat.config.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkCollect.js \
//     'ONESIDE_WETH9_YIN_3000' 1905
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    nftId: v[3],
    rpc: config.networks[net].url,
}

const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider(para.rpc));

const managerJson = require(contracts.nftManagerJson);

async function getUniCollect(nftManager, nftid) {

  console.log(nftid);
  
  var owner = await nftManager.methods.ownerOf(nftid).call();

  console.log(owner);

  var ret = await nftManager.methods.collect({
      tokenId: nftid,
      recipient: owner,
      amount0Max: '0xffffffffffffffffffffffffffffffff',
      amount1Max: '0xffffffffffffffffffffffffffffffff'
  }).call({from: owner});

  return ret;
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

async function getBalance(user, rewardInfos) {
    balance = [];
    for (var rewardInfo of rewardInfos) {
        var tokenAddr = rewardInfo.rewardToken;
        console.log('token addr: ', tokenAddr);
        var token = await attachToken(tokenAddr);
        var b = await token.balanceOf(user.address);
        balance.push(b);
    }
    balance = balance.map((b)=>BigNumber(b._hex));
    return balance;
}
function bigNumberListToStr(b) {
    c = b.map((a)=>a.toFixed(0));
    return c;
}

async function main() {

  // var nftManager = new web3.eth.Contract(managerJson.abi, contracts[net].nftManager);
  // console.log('nftmanager: ',contracts[net].nftManager );
  // uniCollect = await getUniCollect(nftManager, para.nftId);

  // console.log('uniCollect: ', uniCollect);
  // return;
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostV2");
  const mining = await Mining.attach(para.miningPoolAddr);

  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await getRewardInfo(mining, i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfos.push(rewardInfo);
  }

  tokenIds = [para.nftId];
  var originBalances = await getBalance(tester, rewardInfos);
  console.log('origin balance: ', originBalances);
  
    for (id of tokenIds) {

        const blockNumber = await hardhat.ethers.provider.getBlockNumber();
        let reward = await mining.pendingReward(id);

        reward = reward.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        console.log('reward before collect: ' , reward);
        var tx = await mining.connect(tester).collect(id);
        console.log('tx: ', tx);
        
        const blockNumber2 = await hardhat.ethers.provider.getBlockNumber();


        let rewardAfterCollect = await mining.pendingReward(id);

        rewardAfterCollect = rewardAfterCollect.map((r, i)=>{
            return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
        });
        console.log('reward after collect: ', rewardAfterCollect);

        var currBalance = await getBalance(tester, rewardInfos);
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
