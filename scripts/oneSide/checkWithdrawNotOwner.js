const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
var sleep = require('sleep'); 
const config = require("../../hardhat.config.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkWithdrawNotOwner.js \
//     'ONESIDE_WETH9_YIN_3000' 1908
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    nftId: v[3],
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

  tokenIds = [para.nftId];
    for (id of tokenIds) {

        var tx = await mining.withdraw(id, false);
        console.log('tx: ', tx);
        
    }
    
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
