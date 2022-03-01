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
//     'FIXRANGE_V2_USDC_USDT_100' 
//     150000
//
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
    miningPoolSymbolOrAddress: v[2],
    miningPoolAddr: getMiningPoolAddr(v[2]),
    endBlock: v[3],
}

const web3 = getWeb3();
const miningABI = getContractABI(__dirname + '/../../artifacts/contracts/miningFixRangeBoost/MiningFixRangeBoostVeiZi.sol/MiningFixRangeBoostVeiZi.json');

async function main() {
    
  const mining = new web3.eth.Contract(miningABI, para.miningPoolAddr);

  console.log('addr: ', para.miningPoolAddr);

  const owner = await mining.methods.owner().call();
  console.log('owner: ', owner);

  const originEndBlock = (await mining.methods.endBlock().call()).toString();
  console.log('origin end block: ', originEndBlock);
  
  const txData = await mining.methods.modifyEndBlock(para.endBlock).encodeABI()
  const gasLimit = await mining.methods.modifyEndBlock(para.endBlock).estimateGas({from: owner});
  console.log('gas limit: ', gasLimit);
  const nonce = await web3.eth.getTransactionCount(owner, 'pending');
  console.log('nonce: ', nonce);
  const signedTx = await web3.eth.accounts.signTransaction(
      {
          gasPrice: '50000000000',
          to: para.miningPoolAddr,
          data:txData,
          gas: BigNumber(gasLimit * 1.1).toFixed(0, 2),
      }, 
      pk
  );
  // nonce += 1;
  const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log('tx: ', tx);

  const newEndBlock = (await mining.methods.endBlock().call()).toString();
  console.log('new end block: ', newEndBlock);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
