const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("../deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node viewOwner.js 1415

const para = {
    nftid: v[2]
}

/*
 uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
*/
//mint uniswap v3 nft

async function getPosition(nftManager, nftid) {
    var nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity;
    [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity] = await nftManager.positions(nftid);
    nonce = nonce.toString();
    liquidity = liquidity.toString();
    return {
        nonce,
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        liquidity,
    };
}
async function main() {

  //attach to manager
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = positionManagerContract.attach(managerAddress);
  let p = await getPosition(positionsManager, para.nftid);
  console.log(p);
}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
