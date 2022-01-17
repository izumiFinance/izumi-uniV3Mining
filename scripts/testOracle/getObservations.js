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

  var ob0 = await getObservation(pool, 0);
  var ob1 = await getObservation(pool, 1);
  var ob2 = await getObservation(pool, 2);
  var ob3 = await getObservation(pool, 3);
  var ob4 = await getObservation(pool, 4);
  var ob5 = await getObservation(pool, 5);
  var ob6 = await getObservation(pool, 6);
  var ob7 = await getObservation(pool, 7);
  var ob8 = await getObservation(pool, 8);
  var ob9 = await getObservation(pool, 9);
  var ob10 = await getObservation(pool, 10);
  var ob11 = await getObservation(pool, 11);
  var ob12 = await getObservation(pool, 12);
  var ob13 = await getObservation(pool, 13);
  var ob14 = await getObservation(pool, 14);
  var ob15 = await getObservation(pool, 15);

  console.log(ob0.tickCumulative, ob0.blockTimestamp, ob0.initialized);
  console.log(ob1.tickCumulative, ob1.blockTimestamp);
  console.log(ob2.tickCumulative, ob2.blockTimestamp);
  console.log(ob3.tickCumulative, ob3.blockTimestamp);
  console.log(ob4.tickCumulative, ob4.blockTimestamp);
  console.log(ob5.tickCumulative, ob5.blockTimestamp, ob5.initialized);
  console.log(ob6.tickCumulative, ob6.blockTimestamp, ob6.initialized);
  console.log(ob7.tickCumulative, ob7.blockTimestamp, ob7.initialized);
  console.log(ob8.tickCumulative, ob8.blockTimestamp, ob8.initialized);
  console.log(ob9.tickCumulative, ob9.blockTimestamp, ob9.initialized);
  console.log(ob10.tickCumulative, ob10.blockTimestamp, ob10.initialized);
  console.log(ob11.tickCumulative, ob11.blockTimestamp);
  console.log(ob12.tickCumulative, ob12.blockTimestamp);
  console.log(ob13.tickCumulative, ob13.blockTimestamp);
  console.log(ob14.tickCumulative, ob14.blockTimestamp);
  console.log(ob15.tickCumulative, ob15.blockTimestamp, ob15.initialized);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
