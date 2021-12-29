const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
// example
// HARDHAT_NETWORK='izumiTest' \
//     node getNftId.js \
//     'DYNRANGE_WETH9_IZI_3000' 
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
}

async function attachToken(address) {
  var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
  var token = tokenFactory.attach(address);
  return token;
}

async function getDecimal(token) {
  var decimal = await token.decimals();
  return decimal;
}

async function getNumNoDecimal(tokenAddr, num) {
  var token = await attachToken(tokenAddr);
  var decimal = await getDecimal(token);
  var numNoDecimal = BigNumber(num).times(10 ** decimal);
  return numNoDecimal.toFixed(0);
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  let idList = await mining.getTokenIds(tester.address);

  idList = idList.map((bn)=>{return bn.toString();})

  console.log("idlist: ", idList);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
