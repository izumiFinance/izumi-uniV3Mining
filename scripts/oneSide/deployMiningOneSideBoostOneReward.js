const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningOneSideBoostTwoReward.js \
//     'WETH9' 'iZi' 3000 \
//     'iZi' 15 \
//     1 \
//     8900 1000000000000 \
//     1
const v = process.argv
const net = process.env.HARDHAT_NETWORK


var para = {
    tokenUniSymbol: v[2],
    tokenUniAddress: contracts[net][v[2]],
    tokenLockSymbol: v[3],
    tokenLockAddress: contracts[net][v[3]],
    fee: v[4],

    rewardTokenSymbol: v[5],
    rewardTokenAddress: contracts[net][v[5]],
    rewardPerBlock: v[6],

    lockBoostMultiplier: v[7],

    startBlock: v[8],
    endBlock: v[9],

    boost: v[10],
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

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");

  para.rewardPerBlock = await getNumNoDecimal(para.rewardTokenAddress, para.rewardPerBlock);

  console.log("Deploy MiningOneSideBoost Contract: %s/%s", para.tokenUniSymbol,  para.tokenLockSymbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }

  console.log("Deploying .....");

  var iziAddr = '0x0000000000000000000000000000000000000000';

  if (para.boost.toString() != '0') {
    iziAddr = contracts[net]['iZi'];
  }

  console.log('iziAddr: ', iziAddr);

  const mining = await Mining.deploy(
    {
      uniV3NFTManager: contracts.nftManger,
      uniTokenAddr: para.tokenUniAddress,
      lockTokenAddr: para.tokenLockAddress,
      fee: para.fee
    },
    [{
      rewardToken: para.rewardTokenAddress,
      provider: deployer.address,
      accRewardPerShare: 0,
      rewardPerBlock: para.rewardPerBlock,
    }],
    para.lockBoostMultiplier,
    iziAddr,
    para.startBlock, para.endBlock
  );
  await mining.deployed();

  // console.log(mining.deployTransaction);
  
  await approve(await attachToken(para.rewardTokenAddress), deployer, mining.address, "1000000000000000000000000000000");

  console.log("MiningOneSideBoost Contract Address: " , mining.address);

  console.log("iziAddr after deploy: ", await mining.iziToken())

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
