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
//     'ONESIDE_WETH9_IZI_3000' 
//     150000
//     1
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    endBlock: v[3],
}

const web3 = getWeb3();
const miningABI = getContractABI(__dirname + '/../../artifacts/contracts/miningOneSideBoost/MiningOneSideBoostV2.sol/MiningOneSideBoostV2.json');

async function main() {
    
  const mining = new web3.eth.Contract(miningABI, para.miningPoolAddr);

  console.log('addr: ', para.miningPoolAddr);

  const owner = await mining.methods.owner().call();
  console.log('owner: ', owner);

  const originEndBlock = (await mining.methods.endBlock().call()).toString();
  console.log('originEndBlock: ', originEndBlock);

  try {
  
    const txData = await mining.methods.modifyEndBlock(para.endBlock).encodeABI()
    const gasLimit = await mining.methods.modifyEndBlock(para.endBlock).estimateGas({from: owner});
    console.log('gas limit: ', gasLimit);
    const signedTx = await web3.eth.accounts.signTransaction(
        {
            // nonce: 0,
            to: para.miningPoolAddr,
            data:txData,
            gas: BigNumber(gasLimit * 1.1).toFixed(0, 2),
            // gasPrice: 148000000000,
        }, 
        pk
    );
    // nonce += 1;
    const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('tx: ', tx);
  } catch (err) {
    console.log('error: ', err);
  }


  const currentEndBlock = (await mining.methods.endBlock().call()).toString();
  console.log('EndBlock: ', currentEndBlock);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
