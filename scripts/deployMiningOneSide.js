const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node deployMiningOneSide2Rewards.js \
//     'USDC' 'IZI' 3000 \
//     'IZI' '66.6666' \
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

    rewardTokenSymbol: v[5],
    rewardTokenAddress: contracts[net][v[5]],
    rewardPerBlock: v[6],

    startBlock: v[7],
    endBlock: v[8],
}


async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Deploy MiningOneSide Contract: %s/%s", para.tokenUniSymbol,  para.tokenLockSymbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSide");

  console.log("Deploying .....")
  var D18 = BigNumber("10").pow(18);
  const mining = await Mining.deploy(
    para.tokenUniAddress,
    para.tokenLockAddress,
    para.fee,
    contracts.nftManger,
    {
        token: para.rewardTokenAddress,
        provider: deployer.address,
        tokenPerBlock: BigNumber(para.rewardPerBlock).times(D18).toFixed(0),
    },
    para.startBlock,
    para.endBlock
  );
  await mining.deployed();
  console.log("MiningOneSide Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
