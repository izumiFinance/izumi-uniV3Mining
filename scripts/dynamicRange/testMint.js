
const hardhat = require("hardhat");
const { modules } = require("web3");
const contracts = require("../deployed.js");

const BigNumber = require('bignumber.js');

const Web3 = require("web3");
const secret = require('../../.secret.js');
const pk = secret.pk;

const config = require("../../hardhat.config.js");

const v = process.argv
const net = process.env.HARDHAT_NETWORK
const rpc = config.networks[net].url
var web3 = new Web3(new Web3.providers.HttpProvider(rpc));

//Example: HARDHAT_NETWORK='izumiTest' node increaseCardinality.js DYNRANGE_WETH9_IZI_3000

const para = {
    poolSymbol: v[2],
    poolAddress: contracts[net][v[2]],
}

function getContractJson(path) {
    const fs = require('fs');
    let rawdata = fs.readFileSync(path);
    let data = JSON.parse(rawdata);
    return data;
}
function getDynamicRangeABI() {
    var miningJson = getContractJson(__dirname + "/../../artifacts/contracts/miningDynamicRangeBoost/MiningDynamicRangeBoost.sol/MiningDynamicRangeBoost.json");
    return miningJson.abi;
}
async function main() {


  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  
  const [deployer] = await hardhat.ethers.getSigners();
  console.log('deployer: ', deployer.address);


  var mining = new web3.eth.Contract(getDynamicRangeABI(), para.poolAddress);


/*
a:  140000000000000020
addLiquidity.ts:74 b:  1076984168914164900000
addLiquidity.ts:75 izi:  0
*/
  const owner = await mining.methods.owners('1876').call();
  console.log('owner: ', owner);
  const txData = await mining.methods.withdraw('1876', false).encodeABI()
//   const gasLimit = await mining.methods.deposit('140000000000000020', '1076984168914164900000', '0').estimateGas();
  const gasLimit = 4000000;
  console.log('gas limit: ', gasLimit);
  console.log('addr: ', para.poolAddress);
  console.log('pk: ', pk);
  const signedTx = await web3.eth.accounts.signTransaction(
      {
          // nonce: nonce,
          to: para.poolAddress,
          data:txData,
        //   gas: BigNumber(gasLimit * 1.1).toFixed(0, 2),
        gas: gasLimit,
          gasPrice: 2000000000,
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
