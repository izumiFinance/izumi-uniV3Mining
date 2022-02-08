const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const secret = require('../../.secret.js');
const BigNumber = require("bignumber.js");
const {getWeb3} = require('../libraries/getWeb3');
const {getContractABI} = require('../libraries/getContractJson');

const poolJson = require(contracts.poolJson);
// example
// HARDHAT_NETWORK='ethereum' \
//     node getOracle.js 0x6cFA6B2a99B25b36E240b60215CD9a824e8eA545
const v = process.argv
const net = process.env.HARDHAT_NETWORK
const pk = secret.pk

para = {
    poolAddr: v[2]
}

async function getObservation(pool, idx) {
    return pool.methods.observations(idx).call();
}

async function getSlot0(pool) {
    return pool.methods.slot0().call();
}
async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const web3 = getWeb3();
  
  const testOracleABI = getContractABI(__dirname + '/../../artifacts/contracts/test/TestOracle.sol/TestOracle.json');
  console.log('test oracle abi: ', testOracleABI);
  const testOracle = new web3.eth.Contract(testOracleABI, contracts[net].testOracle);

  console.log('test oracle: ', testOracle);
  
  // var tick, sqrtPriceX96, currTick, currSqrtPriceX96;
  // console.log('addr: ', para.poolAddr);
  // console.log('func: ', await testOracle.methods.getAvgTickPriceWithin2Hour(para.poolAddr).call());
  const {tick, sqrtPriceX96, currTick, currSqrtPriceX96} = await testOracle.methods.getAvgTickPriceWithin2Hour(para.poolAddr).call();
  console.log('tick: ', tick);
  console.log('curr tick: ', currTick);
  console.log('sqrt price x96: ', sqrtPriceX96.toString());
  console.log('curr sqrt price x96: ', currSqrtPriceX96.toString());
  
  const pool = new web3.eth.Contract(poolJson.abi, para.poolAddr);

  const s0 = await getSlot0(pool);
  console.log(s0.observationIndex);
  console.log(s0.observationCardinality);

  for (var i = 0; i <= Number(s0.observationIndex) + 1; i ++) {
    console.log(i);
    var ob = await getObservation(pool, i);
    console.log(ob.tickCumulative, ob.blockTimestamp, ob.initialized);
  }

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
