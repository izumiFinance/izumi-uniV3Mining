const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node mineOneSide.js \
//     'ONESIDE_BIT_USDT_3000' 
//     2400
//     0
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    amountUni: v[3],
    amountIZI: v[4],
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
  var numNoDecimal = num * (10 ** decimal);
  return numNoDecimal.toFixed(0);
}

async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");
  const mining = await Mining.attach(para.miningPoolAddr);


  const tokenContract = await hardhat.ethers.getContractFactory("Token");

  const [tokenUniAddr, tokenLockAddr] =  await mining.getMiningContractInfo();
  console.log(tokenUniAddr);
  console.log(tokenLockAddr);
  const tokenIZiAddr = contracts[net]['iZi'];
  para.amountUni = await getNumNoDecimal(tokenUniAddr, para.amountUni);
  para.amountIZI = await getNumNoDecimal(tokenIZiAddr, para.amountIZI);

  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  

  //get tokenUni
  const tokenUni = tokenContract.attach(tokenUniAddr);
  //get tokenUni allowance
  await tokenUni.approve(mining.address, "1000000000000000000000000000000");

  //get tokenLockContract
  const tokenLock = tokenContract.attach(tokenLockAddr);
  //get tokenLock allowance
  await tokenLock.approve(mining.address, "1000000000000000000000000000000");

  const tokenIZI = tokenContract.attach(contracts[net]['iZi']);
  await tokenIZI.approve(mining.address, "1000000000000000000000000000000");

  const tx = await mining.depositWithuniToken(para.amountUni, para.amountIZI, "0xffffffffffffffffffffffffffffffff");

  console.log("tx: ", tx);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
