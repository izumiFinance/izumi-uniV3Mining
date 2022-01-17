const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='polygon' \
//     node deployMiningFixRangeBoostTwoReward.js \
//     'USDC' 'USDT' 500 \
//     'iZi' 0.5555555555 iZi_PROVIDER \
//     'YIN' 0.0694444444 YIN_PROVIDER \
//     23852360 25191560 \
//     t-10 t10 \
//     1 \
//     40 \
//     CHARGE_RECEIVER
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
    rewardProvider0: contracts[net][v[7]],

    rewardTokenSymbol1: v[8],
    rewardTokenAddress1: contracts[net][v[8]],
    rewardPerBlock1: v[9],
    rewardProvider1: contracts[net][v[10]],

    startBlock: v[11],
    endBlock: v[12],
    priceLower0By1OrTickLower: String(v[13]),
    priceUpper0By1OrTickUpper: String(v[14]),

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

  let useTick = para.priceLower0By1OrTickLower[0] == 't';

  if (para.token0Address.toUpperCase() > para.token1Address.toUpperCase()) {
    var tmp = para.token0Address;
    para.token0Address = para.token1Address;
    para.token1Address = tmp;

    tmp = para.token0Symbol;
    para.token0Symbol = para.token1Symbol;
    para.token1Symbol = tmp;

    if (!useTick) {
      var priceLower0By1 = BigNumber(1).div(para.priceUpper0By1OrTickUpper);
      var priceUpper0By1 = BigNumber(1).div(para.priceLower0By1OrTickLower);
      para.priceLower0By1OrTickLower = priceLower0By1;
      para.priceUpper0By1OrTickUpper = priceUpper0By1;
    }
  }

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");

  para.rewardPerBlock0 = await getNumNoDecimal(para.rewardTokenAddress0, para.rewardPerBlock0);
  para.rewardPerBlock1 = await getNumNoDecimal(para.rewardTokenAddress1, para.rewardPerBlock1);

  var tickLower = para.priceLower0By1OrTickLower;
  var tickUpper = para.priceUpper0By1OrTickUpper;

  console.log("Deploy MiningFixRangeBoost Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }

  if (!useTick) {

    var priceLowerNoDecimal0By1 = await priceNoDecimal(para.token0Address, para.token1Address, para.priceLower0By1OrTickLower);
    var priceUpperNoDecimal0By1 = await priceNoDecimal(para.token0Address, para.token1Address, para.priceUpper0By1OrTickUpper);

    console.log('=====================');
    console.log('priceLower0By1 (No Decimal) ', priceLowerNoDecimal0By1);
    console.log('priceUpper0By1 (No Decimal) ', priceUpperNoDecimal0By1);

    tickLower = Math.round(Math.log(priceLowerNoDecimal0By1) / Math.log(1.0001));
    tickUpper = Math.round(Math.log(priceUpperNoDecimal0By1) / Math.log(1.0001));
  } else {
    tickLower = Number(para.priceLower0By1OrTickLower.slice(1));
    tickUpper = Number(para.priceUpper0By1OrTickUpper.slice(1));
  }

  console.log('tick lower: ', tickLower);
  console.log('tick upper: ', tickUpper);


  console.log("Deploying .....");

  var iziAddr = '0x0000000000000000000000000000000000000000';

  if (para.boost.toString() != '0') {
    iziAddr = contracts[net]['iZi'];
  }

  console.log('iziAddr: ', iziAddr);

  var args = [
    {
      uniV3NFTManager: contracts[net].nftManager,
      token0: para.token0Address,
      token1: para.token1Address,
      fee: para.fee,
    },
    [{
      rewardToken: para.rewardTokenAddress0,
      provider: para.rewardProvider0,
      accRewardPerShare: 0,
      rewardPerBlock: para.rewardPerBlock0,
    },
    {
        rewardToken: para.rewardTokenAddress1,
        provider: para.rewardProvider1,
        accRewardPerShare: 0,
        rewardPerBlock: para.rewardPerBlock1,
    }],
    iziAddr,
    tickUpper,
    tickLower,
    para.startBlock, para.endBlock,
    para.feeChargePercent,
    para.chargeReceiver,
  ];

  console.log('args: ', args);

  const mining = await Mining.deploy(
    ...args
  );
  console.log(mining.deployTransaction);
  await mining.deployed();
  
  // await approve(await attachToken(para.rewardTokenAddress0), deployer, mining.address, "1000000000000000000000000000000");
  // await approve(await attachToken(para.rewardTokenAddress1), deployer, mining.address, "1000000000000000000000000000000");

  console.log("MiningFixRangeBoost Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
