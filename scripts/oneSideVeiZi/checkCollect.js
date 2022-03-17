const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
const { ethers } = require("hardhat");
const { getWeb3 } = require("../libraries/getWeb3")
// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkCollect.js \
//     'ONESIDE_WETH9_YIN_3000' 1905
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK
const web3 = getWeb3();

function getAddr(symbolOrAddress) {
  const prefix = symbolOrAddress.slice(0, 2);
  if (prefix.toLowerCase() === '0x') {
    return symbolOrAddress;
  }
  return contracts[net][symbolOrAddress];
}

const weth = contracts[net].WETH9
const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: getAddr(v[2]),
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
  const meta = await mining.getMiningContractInfo();
  return {
      uniToken: meta.uniToken_,
      lockToken: meta.lockToken_,
      fee: meta.fee_,
      lockBoostMultiplier: Number(meta.lockBoostMultiplier_.toString()),
      veiZiAddress: meta.veiZiAddress_,
      totalVLiquidity: meta.totalVLiquidity_.toString(),
      totalLock: meta.totalLock_.toString(),
      totalValidVeiZi: meta.totalValidVeiZi_.toString(),
  }
}

async function getUserStatus(mining, userAddr) {
    const us = await mining.userStatus(userAddr);
    return {
        vLiquidity: us.vLiquidity.toString(),
        validVLiquidity: us.validVLiquidity.toString(),
        veiZi: us.veiZi.toString(),
        validVeiZi: us.validVeiZi.toString(),
    }
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
        } else if (tokenAddr != weth) {
          var token = await attachToken(tokenAddr);
          var b = await token.balanceOf(user.address);
          balance.push(b);
        } else {
          var b = await ethers.provider.getBalance(user.address);
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
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const nftPositionMangerAddress = contracts[net].nftManager;

async function getUniswapCollectAmount(nftId, tokenUni, tokenLock) {
    const managerWeb3 = new web3.eth.Contract(NonfungiblePositionManager.abi, nftPositionMangerAddress);
    const owner = para.miningPoolAddr;
    console.log('owner: ', await managerWeb3.methods.ownerOf(nftId).call());
    console.log('farm: ', owner);
    const collectRet = await managerWeb3.methods.collect({
        tokenId: nftId,
        amount0Max: '0xffffffffffffffffffffffffffffffff',
        amount1Max: '0xffffffffffffffffffffffffffffffff',
        recipient: owner,
    }).call({from: owner});
    const amount0 = collectRet.amount0.toString();
    const amount1 = collectRet.amount1.toString();
    if (tokenUni.toLowerCase() < tokenLock.toLowerCase()) {
        return {
            amountUni: amount0,
            amountLock: amount1,
        };
    } else {
        return {
            amountUni: amount1,
            amountLock: amount0,
        }
    }
}

async function getUniswapWithdrawTokenAmount(nftId, liquidity, tokenUni, tokenLock) {
    const managerWeb3 = new web3.eth.Contract(NonfungiblePositionManager.abi, nftPositionMangerAddress);
    const owner = para.miningPoolAddr;
    const decreaseRet = await managerWeb3.methods.decreaseLiquidity({
        tokenId: nftId,
        liquidity: liquidity,
        amount0Min: '0',
        amount1Min: '0',
        deadline: '0xffffffff',
    }).call({from: owner});
    const amount0 = decreaseRet.amount0.toString();
    const amount1 = decreaseRet.amount1.toString();
    if (tokenUni.toLowerCase() < tokenLock.toLowerCase()) {
        return {
            amountUni: amount0,
            amountLock: amount1,
        };
    } else {
        return {
            amountUni: amount1,
            amountLock: amount0,
        }
    }
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
  const mining = Mining.attach(para.miningPoolAddr);

  const meta = await getMeta(mining);

  var totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
  var totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();

  var collectTokens = [];
  var amountNoDecimal = [];

  var rewardInfosLen = await mining.rewardInfosLen();
  console.log('rewardInfosLen: ', rewardInfosLen);

  const rewardPerBlock = []

  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await getRewardInfo(mining, i);
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      collectTokens.push(rewardInfo.rewardToken);
      rewardPerBlock.push(rewardInfo.rewardPerBlock);
  }

  lockBoostMul = BigNumber(meta.lockBoostMultiplier);
  console.log('lockBoostMul: ', lockBoostMul.toString());

  console.log('tokens: ', collectTokens);

  var originBalances = await getBalance(tester, collectTokens);
  console.log('origin balance: ', originBalances);

  console.log('total fee charged0: ', totalFeeCharged0);
  console.log('total fee charged1: ', totalFeeCharged1);
  
  const blockNumber = await hardhat.ethers.provider.getBlockNumber();
  let reward = await mining.pendingRewards(tester.address);
  reward = reward.map((r)=>r.toString());

  console.log('reward before collect: ' , reward);
  console.log('rewardPerBlock: ', rewardPerBlock);

  const userStatusBefore = await getUserStatus(mining, tester.address);
  console.log('user vLiquidity before withdraw: ', userStatusBefore.vLiquidity);
  console.log('user validVLiquidity before withdraw: ', userStatusBefore.validVLiquidity);
  console.log('user veiZi before withdraw: ', userStatusBefore.veiZi);
  console.log('user validVeiZi before withdraw: ', userStatusBefore.validVeiZi);

  var tx = await mining.connect(tester).collectAllTokens();
  console.log(tx);
  
  const blockNumber2 = await hardhat.ethers.provider.getBlockNumber();

  var currBalance = await getBalance(tester, collectTokens);
  console.log('curr balance: ', currBalance);
  for (var i = 0; i < currBalance.length; i ++) {
      currBalance[i]=currBalance[i].minus(originBalances[i]);
  }
  console.log('delta: ', currBalance);
  console.log('delta: ', bigNumberListToStr(currBalance));
  currBalance = currBalance.map((r)=>{
      return r.toString();
  });
  console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward, ' ', currBalance);
    
  totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
  totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();
  console.log('total fee charged0: ', totalFeeCharged0);
  console.log('total fee charged1: ', totalFeeCharged1);

  const metaAfter = await getMeta(mining);
  console.log('totalVLiquidity: ', meta.totalVLiquidity, ' ', metaAfter.totalVLiquidity);
  console.log('totalValidVeiZi: ', meta.totalValidVeiZi, ' ', metaAfter.totalValidVeiZi);
  const userAfter = await getUserStatus(mining, tester.address);
  console.log('user vLiquidity: ', userStatusBefore.vLiquidity, ' ', userAfter.vLiquidity);
  console.log('user veiZi after withdraw: ', userStatusBefore.veiZi, ' ' , userAfter.veiZi);
  console.log('user validVeiZi after withdraw: ', userStatusBefore.validVeiZi, ' ' , userAfter.validVeiZi);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
