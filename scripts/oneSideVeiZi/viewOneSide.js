const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 

// example
// HARDHAT_NETWORK='izumiTest' \
//     node viewOneSide.js \
//     'ONESIDE_VEIZI_USDC_IZI_3000' [user address]
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    userAddr: v[3],
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
  const miningContractInfo = await mining.getMiningContractInfo();
  return {
      uniToken: miningContractInfo.uniToken_,
      lockToken: miningContractInfo.lockToken_,
      fee: miningContractInfo.fee_,
      totalVLiquidity: miningContractInfo.totalVLiquidity_.toString(),
      totalLock: miningContractInfo.totalLock_.toString(),
      totalValidVeiZi: miningContractInfo.totalValidVeiZi_.toString(),
      startBlock: miningContractInfo.startBlock_.toString(),
      endBlock: miningContractInfo.endBlock_.toString()
  }
}
async function getTokenStatus(mining, nftId) {
  const tokenStatus = await mining.tokenStatus(nftId);
  return {
      nftId: tokenStatus.nftId.toString(),
      uniLiquidity: tokenStatus.uniLiquidity.toString(),
      lockAmount: tokenStatus.lockAmount.toString(),
      vLiquidity: tokenStatus.vLiquidity.toString(),
  }
}
async function getUserStatus(mining, userAddr) {
    const userStatus = await mining.userStatus(userAddr);
    return {
        vLiquidity: userStatus.vLiquidity.toString(),
        validVLiquidity: userStatus.validVLiquidity.toString(),
        veiZi: userStatus.veiZi.toString(),
        veStakingId: userStatus.veStakingId.toString(),
        validVeiZi: userStatus.validVeiZi.toString(),
    }
}
async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
  const mining = Mining.attach(para.miningPoolAddr);

  console.log('owner: ', await mining.owner());

  let rewardInfos = [];
  const amountNoDecimal = [];
  for (var i = 0; i < await mining.rewardInfosLen(); i ++) {
      const rewardInfo = await mining.rewardInfos(i);
      console.log('reward token: ', i, ' ', rewardInfo.rewardToken, ' ', rewardInfo.rewardPerBlock.toString());
      amountNoDecimal.push(await getNumNoDecimal(rewardInfo.rewardToken, 1));
      rewardInfos.push(rewardInfo);
  }

  console.log('rewardInfos: ', rewardInfos);
  let meta = await getMeta(mining);
  console.log('meta: ', meta);

  
  while(true) {
    meta = await getMeta(mining);

    const blockNumber = await hardhat.ethers.provider.getBlockNumber();
    let reward = await mining.pendingRewards(para.userAddr);

    reward = reward.map((r, i)=>{
        return BigNumber(r.toString()).div(amountNoDecimal[i]).toFixed(10);
    });
    const userStatus = await getUserStatus(mining, para.userAddr);
    
    const blockNumber2 = await hardhat.ethers.provider.getBlockNumber();
    console.log('blocknumber: ', blockNumber, '/', blockNumber2, ' ', reward);
    console.log('validVL: ', userStatus.validVLiquidity, 'vliquidity: ', userStatus.vLiquidity, ' veiZi: ', userStatus.veiZi, 'validVe: ', userStatus.validVeiZi);
    console.log('totalV: ', meta.totalVLiquidity, ' totalValidVeiZi: ', meta.totalValidVeiZi, ' endblock: ', meta.endBlock, ' totalLock: ', meta.totalLock);
    
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
