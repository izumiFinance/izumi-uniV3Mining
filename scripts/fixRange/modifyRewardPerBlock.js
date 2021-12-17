const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyEndBlock.js \
//     'FIXRANGE_USDC_USDT_100' 
//     0
//     5000000000000000000
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    rewardIdx: v[3],
    rewardPerBlockAmount: v[4],
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  tx = await mining.modifyRewardPerBlock(para.rewardIdx, para.rewardPerBlockAmount);
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
