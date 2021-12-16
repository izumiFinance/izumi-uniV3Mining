const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

const poolJson = require(contracts.poolJson);
// example
// HARDHAT_NETWORK='izumiTest' \
//     node getOracle.js 0x23Fd99b8566312305383e68517Fd6b274F2C16c2
const v = process.argv
const net = process.env.HARDHAT_NETWORK

para = {
    poolAddr: v[2]
}

async function getObservation(pool, idx) {
    var blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized;
    [blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized] = await pool.observations(idx);
    blockTimestamp = blockTimestamp.toString();
    tickCumulative = tickCumulative.toString();
    return {
        blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized
    };
}

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const TestOracle = await hardhat.ethers.getContractFactory("TestOracle");
  const testOracle = TestOracle.attach(contracts[net].testOracle);
  
  var tick, sqrtPriceX96, currTick, currSqrtPriceX96;
  [tick, sqrtPriceX96, currTick, currSqrtPriceX96] = await testOracle.getAvgTickPriceWithinHour(para.poolAddr);
  console.log('tick: ', tick);
  console.log('curr tick: ', currTick);
  console.log('sqrt price x96: ', sqrtPriceX96);


  const poolContract = await hardhat.ethers.getContractFactory(poolJson.abi, poolJson.bytecode, deployer);
  const pool = poolContract.attach(para.poolAddr);

  var ob0 = await getObservation(pool, 0);
  var ob1 = await getObservation(pool, 1);
  var ob2 = await getObservation(pool, 2);
  var ob3 = await getObservation(pool, 3);
  var ob4 = await getObservation(pool, 4);
  var ob5 = await getObservation(pool, 5);
  var ob6 = await getObservation(pool, 6);
  var ob7 = await getObservation(pool, 7);

  console.log(ob0.tickCumulative, ob0.blockTimestamp);
  console.log(ob1.tickCumulative, ob1.blockTimestamp);
  console.log(ob2.tickCumulative, ob2.blockTimestamp);
  console.log(ob3.tickCumulative, ob3.blockTimestamp);
  console.log(ob4.tickCumulative, ob4.blockTimestamp);
  console.log(ob5.tickCumulative, ob5.blockTimestamp);
  console.log(ob6.tickCumulative, ob6.blockTimestamp);
  console.log(ob7.tickCumulative, ob7.blockTimestamp);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
