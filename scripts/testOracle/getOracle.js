const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

const {getWeb3} = require('../libraries/getWeb3');
const {getContractABI} = require('../libraries/getContractJson');
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

  const web3 = getWeb3();
  const testOracleABI = getContractABI(__dirname + '/../../artifacts/contracts/test/TestOracle.sol/TestOracle.json');
  
  const testOracle = new web3.eth.Contract(testOracleABI, contracts[net].testOracle);
  
  const {tick, sqrtPriceX96, currTick, currSqrtPriceX96} = await testOracle.methods.getAvgTickPriceWithin2Hour(para.poolAddr).call();
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
