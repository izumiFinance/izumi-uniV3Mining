const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkReceiveFeeCharged.js \
//     'FIXRANGE_V2_USDC_USDT_100' 

const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
}


async function main() {
    
  const [deployer, tester, receiver] = await hardhat.ethers.getSigners();

  console.log('recevier:' ,receiver.address);

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  tx = await mining.connect(receiver).collectFeeCharged();
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
