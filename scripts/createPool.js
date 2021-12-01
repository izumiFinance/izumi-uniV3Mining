const { BigNumber } = require("bignumber.js");
const hardhat = require("hardhat");

//Example:
//HARDHAT_NETWORK='izumiTest' node createPool.js MIM USDC 500 1
//


const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],
    priceToken0By1: v[5],
}

async function attachToken(address) {
  var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
  var token = tokenFactory.attach(address);
  return token;
}

async function main() {
  // We get the signer's info
  const [deployer] = await hardhat.ethers.getSigners();
  console.log("Creating pool with the account:",
    deployer.address)
  console.log("Account balance:", (await deployer.getBalance()).toString());
  para.priceToken0By1 = Number(para.priceToken0By1);

  if (para.token1Address.toUpperCase() < para.token0Address.toUpperCase()) {
    var tmp = para.token0Symbol;
    para.token0Symbol = para.token1Symbol;
    para.token1Symbol = tmp;
    tmp = para.token0Address;
    para.token0Address = para.token1Address;
    para.token1Address = tmp;
    
    para.priceToken0By1 = 1.0 / para.priceToken0By1;
  }

  var token0 = await attachToken(para.token0Address);
  var token1 = await attachToken(para.token1Address);

  var decimal0 = await token0.decimals();
  var decimal1 = await token1.decimals();
  var priceToken0By1 = para.priceToken0By1 * (10 ** decimal1) / (10 ** decimal0);
  console.log("token0: ", para.token0Symbol, " ", para.token0Address, " decimal: ", decimal0);
  console.log("token1: ", para.token1Symbol, " ", para.token1Address, " decimal: ", decimal1);
  console.log("origin price: ", para.priceToken0By1);
  console.log("new price: ", priceToken0By1);

  var priceToken0By1Sqrt = BigNumber(priceToken0By1).sqrt();
  console.log('priceSqrt: ', priceToken0By1Sqrt.toString());

  var priceToken0By1SqrtX96 = priceToken0By1Sqrt.times(BigNumber(2).pow(96)).toFixed(0);

  console.log('priceSqrtX96: ', priceToken0By1SqrtX96);


  const managerContract = await hardhat.ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const manager = managerContract.attach(managerAddress);

  //Check whether attach successfully
  console.log(await manager.factory(), "attach successfully");
  //If there is no pool or pool not inited with token0 & token1, create and init one
  const tx = await manager.createAndInitializePoolIfNecessary(para.token0Address, para.token1Address, para.fee, priceToken0By1SqrtX96);
  console.log(tx.hash);
  console.log("Create pool successfully!");
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
