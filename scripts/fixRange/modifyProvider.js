const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');

const {getWeb3} = require('../libraries/getWeb3');
const {getContractABI} = require('../libraries/getContractJson');

const secret = require('../../.secret.js');
const pk = secret.pk;
// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyEndBlock.js \
//     'FIXRANGE_USDC_USDT_100' 
//     0
//     0x...
const v = process.argv
const net = process.env.HARDHAT_NETWORK

function getMiningPoolAddr(symbolOrAddress) {
  const prefix = symbolOrAddress.slice(0, 2);
  if (prefix.toLowerCase() === '0x') {
    return symbolOrAddress;
  }
  return contracts[net][symbolOrAddress];
}

const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: getMiningPoolAddr(v[2]),
    rewardIdx: v[3],
    providerAddress: v[4],
}

const web3 = getWeb3();
const miningABI = getContractABI(__dirname + '/../../artifacts/contracts/miningFixRangeBoost/MiningFixRangeBoostV2.sol/MiningFixRangeBoostV2.json');

async function main() {

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
    
  const mining = new web3.eth.Contract(miningABI, para.miningPoolAddr);

  console.log('addr: ', para.miningPoolAddr);

  const owner = await mining.methods.owner().call();
  console.log('owner: ', owner);
  
  const txData = await mining.methods.modifyProvider(para.rewardIdx, para.providerAddress).encodeABI()
  const gasLimit = await mining.methods.modifyProvider(para.rewardIdx, para.providerAddress).estimateGas({from: owner});
  console.log('gas limit: ', gasLimit);
  const signedTx = await web3.eth.accounts.signTransaction(
      {
          // nonce: 0,
          to: para.miningPoolAddr,
          data:txData,
          gas: BigNumber(gasLimit * 1.1).toFixed(0, 2),
      }, 
      pk
  );
  // nonce += 1;
  const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
