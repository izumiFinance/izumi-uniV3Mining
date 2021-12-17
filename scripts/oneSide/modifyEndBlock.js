const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyEndBlock.js \
//     'ONESIDE_WETH9_IZI_3000' 
//     10150
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    endBlock: v[3],
}

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  await mining.modifyEndBlock(para.endBlock);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
