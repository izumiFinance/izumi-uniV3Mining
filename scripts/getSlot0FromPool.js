const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const poolJson = require(contracts.poolJson);
const getPool = require("./getPool.js")

const v = process.argv
const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
}

async function main() {
  // get pool address
  const poolAddress = await getPool.main(para.token0Address, para.token1Address, para.fee);
  console.log("pool: ", poolAddress);

  const poolContract = await hardhat.ethers.getContractFactory(poolJson.abi, poolJson.bytecode, deployer);
  const pool = await poolContract.attach(poolAddress);

  // check the info of pool
  console.log(await pool.token0(), await pool.token1());
  const slot0 = await pool.slot0();
  console.log(slot0);
  return slot0;
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})