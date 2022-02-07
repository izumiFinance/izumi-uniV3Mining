const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningDynamicRangeBoostV2TwoReward.js \
//     'DDAO' 'WETH9' 3000 \
//     'iZi' 0.462962962 iZi_PROVIDER \
//     'DDAO' 0.09259259259 DDAO_PROVIDER \
//      14409 20000 \
//      0.25 4 \
//      1 \
//      40 \
//      CHARGE_RECEIVER 
const v = process.argv
const net = process.env.HARDHAT_NETWORK


var para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],

    rewardTokenSymbol0: v[5],
    rewardTokenAddress0: contracts[net][v[5]],
    rewardPerBlock0: v[6],
    provider0Symbol: v[7],
    provider0: contracts[net][v[7]],

    rewardTokenSymbol1: v[8],
    rewardTokenAddress1: contracts[net][v[8]],
    rewardPerBlock1: v[9],
    provider1Symbol: v[10],
    provider1: contracts[net][v[10]],

    startBlock: v[11],
    endBlock: v[12],

    pcLeftScale: v[13],
    pcRightScale: v[14],

    boost: v[15],
    feeChargePercent: v[16],
    chargeReceiver: contracts[net][v[17]],
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

async function priceNoDecimal(tokenAddr0, tokenAddr1, priceDecimal0By1) {
  var token0 = await attachToken(tokenAddr0);
  var token1 = await attachToken(tokenAddr1);

  var decimal0 = await getDecimal(token0);
  var decimal1 = await getDecimal(token1);

  var priceNoDecimal0By1 = priceDecimal0By1 * (10 ** decimal1) / (10 ** decimal0);
  return priceNoDecimal0By1;
}

async function approve(token, account, destAddr, amount) {
  await token.connect(account).approve(destAddr, amount);
}

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  if (para.token0Address.toUpperCase() > para.token1Address.toUpperCase()) {
    var tmp = para.token0Address;
    para.token0Address = para.token1Address;
    para.token1Address = tmp;

    tmp = para.token0Symbol;
    para.token0Symbol = para.token1Symbol;
    para.token1Symbol = tmp;
  }

  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoostV2");

  para.rewardPerBlock0 = await getNumNoDecimal(para.rewardTokenAddress0, para.rewardPerBlock0);
  para.rewardPerBlock1 = await getNumNoDecimal(para.rewardTokenAddress1, para.rewardPerBlock1);
  console.log("Deploy MiningDynamicRangeBoostV2 Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }

  console.log('=====================');


  console.log("Deploying .....");

  var iziAddr = '0x0000000000000000000000000000000000000000';

  if (para.boost.toString() != '0') {
    iziAddr = contracts[net]['iZi'];
  }

  console.log('iziAddr: ', iziAddr);

  tickRangeLeft = Math.round(Math.log(1.0 / Number(para.pcLeftScale)) / Math.log(1.0001));
  tickRangeRight = Math.round(Math.log(para.pcRightScale) / Math.log(1.0001));

  console.log('tick range left: ', tickRangeLeft);
  console.log('tick range right: ', tickRangeRight);

  const mining = await Mining.deploy(
      {
        uniV3NFTManager: contracts[net].nftManager,
        token0: para.token0Address,
        token1: para.token1Address,
        fee: para.fee
      },
    [{
      rewardToken: para.rewardTokenAddress0,
      provider: para.provider0,
      accRewardPerShare: 0,
      rewardPerBlock: para.rewardPerBlock0,
    },
    {
      rewardToken: para.rewardTokenAddress1,
      provider: para.provider1,
      accRewardPerShare: 0,
      rewardPerBlock: para.rewardPerBlock1,
    }],
    iziAddr,
    para.startBlock, para.endBlock,
    para.feeChargePercent,
    para.chargeReceiver,
    tickRangeLeft,
    tickRangeRight
  );
  await mining.deployed();
  
  console.log("MiningDynamicRangeBoost Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
