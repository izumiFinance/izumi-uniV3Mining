const hardhat = require("hardhat");
const { modules } = require("web3");
const contracts = require("./deployed.json");
const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

const v = process.argv
const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
}

async function getPool(token0Address, token1Address, fee) {
    // We get the signer's info
  const [deployer] = await hardhat.ethers.getSigners();
//   console.log("Creating pool with the account:",
//     deployer.address)
//   console.log("Account balance:", (await deployer.getBalance()).toString());

  const factoryContract = await hardhat.ethers.getContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
  const factory = await factoryContract.attach(factoryAddress);
  //get the info of pool
  let pool = await factory.getPool(token0Address, token1Address, fee);
  console.log(pool);
  return;
}

getPool(para.token0Address, para.token1Address, para.fee).then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})

module.exports = getPool;
