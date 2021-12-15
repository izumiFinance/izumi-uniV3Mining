const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningFixRangeBoostTwoReward.js \
//     'BIT' 'USDC' 3000 \
//     'iZi' 10 \
//     'BIT' 10 \
//     0 1000000000000 \
//     1.26 5.05 \
//     0
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

    rewardTokenSymbol1: v[7],
    rewardTokenAddress1: contracts[net][v[7]],
    rewardPerBlock1: v[8],

    startBlock: v[9],
    endBlock: v[10],
    priceLower0By1: BigNumber(v[11]),
    priceUpper0By1: BigNumber(v[12]),

    boost: v[13],
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

    var priceLower0By1 = BigNumber(1).div(para.priceUpper0By1);
    var priceUpper0By1 = BigNumber(1).div(para.priceLower0By1);
    para.priceLower0By1 = priceLower0By1;
    para.priceUpper0By1 = priceUpper0By1;
  }

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");

  para.rewardPerBlock0 = await getNumNoDecimal(para.rewardTokenAddress0, para.rewardPerBlock0);
  para.rewardPerBlock1 = await getNumNoDecimal(para.rewardTokenAddress1, para.rewardPerBlock1);

  var priceLowerNoDecimal0By1 = await priceNoDecimal(para.token0Address, para.token1Address, para.priceLower0By1);
  var priceUpperNoDecimal0By1 = await priceNoDecimal(para.token0Address, para.token1Address, para.priceUpper0By1);

  console.log("Deploy MiningFixRangeBoost Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }

  console.log('=====================');
  console.log('priceLower0By1 (No Decimal) ', priceLowerNoDecimal0By1);
  console.log('priceUpper0By1 (No Decimal) ', priceUpperNoDecimal0By1);

  var tickLower = Math.round(Math.log(priceLowerNoDecimal0By1) / Math.log(1.0001));
  var tickUpper = Math.round(Math.log(priceUpperNoDecimal0By1) / Math.log(1.0001));

  console.log('tick lower: ', tickLower);
  console.log('tick upper: ', tickUpper);


  console.log("Deploying .....");

  var iziAddr = '0x0000000000000000000000000000000000000000';

  if (para.boost.toString() != '0') {
    iziAddr = contracts[net]['iZi'];
  }

  console.log('iziAddr: ', iziAddr);

  const mining = await Mining.deploy(
    contracts.nftManger,
    para.token0Address,
    para.token1Address,
    para.fee,
    [{
      rewardToken: para.rewardTokenAddress0,
      provider: deployer.address,
      accRewardPerShare: 0,
      rewardPerBlock: para.rewardPerBlock0,
    },
    {
        rewardToken: para.rewardTokenAddress1,
        provider: deployer.address,
        accRewardPerShare: 0,
        rewardPerBlock: para.rewardPerBlock1,
    }],
    iziAddr,
    tickUpper,
    tickLower,
    para.startBlock, para.endBlock
  );
  await mining.deployed();
  
  await approve(await attachToken(para.rewardTokenAddress0), deployer, mining.address, "1000000000000000000000000000000");
  await approve(await attachToken(para.rewardTokenAddress1), deployer, mining.address, "1000000000000000000000000000000");

  console.log("MiningFixRangeBoost Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });