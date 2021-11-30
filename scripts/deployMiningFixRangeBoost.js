const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningFixRangeBoo.js \
//     'USDC' 'BIT' 3000 \
//     'BIT' '3.3333' \ 
//     'IZI' '33.3333' \
//      0 1000000 \
//      -100000 100000
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
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
    tickLower: v[11],
    tickUpper: v[12],
}


async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Deploy MiningFixRangeBoost Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");

  console.log("Deploying .....")
  var D18 = BigNumber("10").pow(18);
  var rewardPerBlock0 = D18.times(para.rewardPerBlock0).toFixed(0);
  console.log("aaa")
  var rewardPerBlock1 = D18.times(para.rewardPerBlock1).toFixed(0);
  console.log("bbb")
  console.log("rewardPerBlock0: ", rewardPerBlock0);
  console.log("rewardPerBlock1: ", rewardPerBlock1);
  var iziAddr = contracts[net].IZI;
  console.log('izi addr: ', iziAddr);
  const mining = await Mining.deploy(
    contracts.nftManger,
    para.token0Address,
    para.token1Address,
    para.fee,
    [{
      rewardToken: para.rewardTokenAddress0,
      provider: deployer.address,
      accRewardPerShare: 0,
      rewardPerBlock: rewardPerBlock0,
    },{
      rewardToken: para.rewardTokenAddress1,
      provider: deployer.address,
      accRewardPerShare: 0,
      rewardPerBlock: rewardPerBlock1,
    }],
    iziAddr,
    para.tickUpper,
    para.tickLower,
    para.startBlock, para.endBlock
  );
  await mining.deployed();
  
  console.log("MiningFixRangeBoost Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
