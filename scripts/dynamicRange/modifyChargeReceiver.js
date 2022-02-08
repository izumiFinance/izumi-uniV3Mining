const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyChargeReceiver.js \
//     'DYNRANGE_WETH9_DDAO_3000' 
//     0x7628c09B7B808285A35815125e8c05d16D9Baa7b
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    receiver: v[3],
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  tx = await mining.modifyChargeReceiver(para.receiver);
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
