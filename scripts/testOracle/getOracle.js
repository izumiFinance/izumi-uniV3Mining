const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node getOracle.js 0x23Fd99b8566312305383e68517Fd6b274F2C16c2
const v = process.argv
const net = process.env.HARDHAT_NETWORK

para = {
    poolAddr: v[2]
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

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
