const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 
const config = require("../../hardhat.config.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node viewFeeCharged.js \
//     'ONESIDE_ETHT_IZIT_3000' 1963
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    rpc: config.networks[net].url,
}

async function main() {

  // var nftManager = new web3.eth.Contract(managerJson.abi, contracts[net].nftManager);
  // console.log('nftmanager: ',contracts[net].nftManager );
  // uniCollect = await getUniCollect(nftManager, para.nftId);

  // console.log('uniCollect: ', uniCollect);
  // return;
    
  const [deployer, tester] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);
  console.log('tester: ', tester.address);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  console.log('total fee charged0: ', (await mining.totalFeeCharged0()).toString());
  console.log('total fee charged1: ', (await mining.totalFeeCharged1()).toString());
  console.log('fee charge receiver: ', (await mining.chargeReceiver()));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
