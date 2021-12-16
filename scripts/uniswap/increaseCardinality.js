const hardhat = require("hardhat");
const { modules } = require("web3");
const contracts = require("../deployed.js");

const BigNumber = require('bignumber.js');

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

const swapRouterJson = require(contracts.swapRouterJson);
const swapRouterAddress = contracts.swapRouterAddress;

const poolJson = require(contracts.poolJson);

const v = process.argv
const net = process.env.HARDHAT_NETWORK

//Example: HARDHAT_NETWORK='izumiTest' node swapPriceDown.js iZi WETH9 3000 10

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],
    cardinality: v[5]
}

async function main() {


  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  
  const [deployer] = await hardhat.ethers.getSigners();

  const factoryContract = await hardhat.ethers.getContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
  const factory = factoryContract.attach(factoryAddress);
  
  //get the info of pool
  let poolAddr = await factory.getPool(para.token0Address, para.token1Address, para.fee);
  console.log('Pool: ', poolAddr);

  const poolContract = await hardhat.ethers.getContractFactory(poolJson.abi, poolJson.bytecode, deployer);
  const pool = poolContract.attach(poolAddr);

  await pool.increaseObservationCardinalityNext(para.cardinality);
  
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})

module.exports = main;
