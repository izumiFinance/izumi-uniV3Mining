const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkEmergencyWithdraw.js \
//     'FIXRANGE_V2_USDC_USDT_100_EMERGENCY_WITHDRAW' 1968
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK

function getAddr(symbolOrAddress) {
  const prefix = symbolOrAddress.slice(0, 2);
  if (prefix.toLowerCase() === '0x') {
    return symbolOrAddress;
  }
  return contracts[net][symbolOrAddress];
}

const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: getAddr(v[2]),
    nftId: v[3],
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);
  const tx = await mining.emergenceWithdraw(para.nftId);
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
