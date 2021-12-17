const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyEndBlock.js \
//     'FIXRANGE_USDC_USDT_100' 
//     10656
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    endBlock: v[3],
}

async function main() {
    
  const [deployer,tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  let tx = await mining.modifyEndBlock(para.endBlock);
  console.log(tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
