const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningOneSide2Rewards.js \
//     'USDC' 'BIT' 3000 \
//     'BIT' '3.3333' \ 
//     'IZI' '33.3333' \
//      0 1000000
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    tokenUniSymbol: v[2],
    tokenUniAddress: contracts[net][v[2]],
    tokenLockSymbol: v[3],
    tokenLockAddress: contracts[net][v[3]],
    fee: v[4],

    rewardTokenSymbol0: v[5],
    rewardTokenAddress0: contracts[net][v[5]],
    rewardPerBlock0: v[6],

    rewardTokenSymbol1: v[7],
    rewardTokenAddress1: contracts[net][v[7]],
    rewardPerBlock1: v[8],

    startBlock: v[9],
    endBlock: v[10],
}


async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Deploy MiningOneSide2Rewards Contract: %s/%s", para.tokenUniSymbol,  para.tokenLockSymbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSide2Rewards");

  console.log("Deploying .....")
  var D18 = BigNumber("10").pow(18);
  const mining = await Mining.deploy(
    para.tokenUniAddress,
    para.tokenLockAddress,
    para.fee,
    contracts.nftManger,
    {
        token0: para.rewardTokenAddress0,
        provider0: deployer.address,
        tokenPerBlock0: BigNumber(para.rewardPerBlock0).times(D18).toFixed(0),

        token1: para.rewardTokenAddress1,
        provider1: deployer.address,
        tokenPerBlock1: BigNumber(para.rewardPerBlock1).times(D18).toFixed(0)
    },
    para.startBlock,
    para.endBlock
  );
  await mining.deployed();
  console.log("MiningOneSide2Rewards Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
