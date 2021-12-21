const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node getSqrtPrice.js tick
const v = process.argv
const net = process.env.HARDHAT_NETWORK

para = {
    tick: v[2]
}


async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const TestPow = await hardhat.ethers.getContractFactory("TestPow");
  const testPow = TestPow.attach(contracts[net].testPow);
  
  var sqrtPriceX96 = await testPow.getSqrtPrice(para.tick);
  
  console.log('tp: ', sqrtPriceX96.toString());
  let a = Math.floor(para.tick / 2);
  let b = para.tick - a;

  var sqrtPriceX96BN_a = BigNumber(1.0001).pow(a/2).times(BigNumber(2).pow(48));
  var sqrtPriceX96BN_b = BigNumber(1.0001).pow(b/2).times(BigNumber(2).pow(48));
  console.log('bn: ', sqrtPriceX96BN_a.times(sqrtPriceX96BN_b).toFixed(0));

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
