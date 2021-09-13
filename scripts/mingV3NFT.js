const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv


const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
    rewardUpperTick: v[5],
    rewardLowerTick: v[6],
    amount0Desired: v[7],
    amount1Desired: v[8],
    amount0Min: v[9],
    amount1Min: v[10],
    deadline: v[11],
}


//mint uniswap v3 nft
async function main() {
    //attach to manager
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = await positionManagerContract.attach(managerAddress);
  
  const tokenContract = await hre.ethers.getContractFactory("Token");

  //get token0Contract
  const token0Contract = await tokenContract.attach(para.token0Address);
  //get token0 allowance
  await token0Contract.approve(managerAddress, para.amount0Desired);
  console.log(await token0Contract.allowance(deployer.address, managerAddress));
  
  //get token1Contract
  const token1Contract = await tokenContract.attach(para.token1Address);
  //get token1 allowance
  await token1Contract.approve(managerAddress, para,amount1Desired);
  console.log(await token1Contract.allowance(deployer.address, managerAddress));

  //mint nft
  const parameter = { 
      token0: para.token0Address, 
      token1: para.token1Address, 
      fee: para.fee, 
      tickLower: para.rewardLowerTick, 
      tickUpper: para.rewardUpperTick, 
      amount0Desired: para.amount0Desired, 
      amount1Desired: para.amount1Desired, 
      amount0Min: para.amount0Min, 
      amount1Min: para.amount1Min, 
      recipient: deployer.address, 
      deadline: para.deadline};
  const tx = await positionsManager.mint(parameter);
  console.log(tx);
}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})