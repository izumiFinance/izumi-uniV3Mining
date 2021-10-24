const {ethers} = require("hardhat");
const hre = require("hardhat");
const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv


// Example: HARDHAT_NETWORK='izumi_test' node mingV3NFT.js 'USDT' 'WETH9' 3000 120 -120 "10000000000" "10000000000" 0 0 10000000000000000 10000000000 1

const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
    upperTick: v[5],
    lowerTick: v[6],
    amount0Desired: v[7],
    amount1Desired: v[8],
    amount0Min: v[9],
    amount1Min: v[10],
    deadline: v[11],
    value: v[12],
	approveFirst: parseInt(v[13]),
}


//mint uniswap v3 nft
async function main() {

  // We get the contract to deploy
  if (para.token0Address.toLowerCase() > para.token1Address.toLowerCase()) {
	//console.log("The tokens are not correctly ordered, pleace check...")
    [para.token0Symbol, para.token1Symbol] = [para.token1Symbol, para.token0Symbol];
    [para.token0Address, para.token1Address] = [para.token1Address, para.token0Address];
    [para.upperTick, para.lowerTick] = [-para.lowerTick, -para.upperTick];
    [para.amount0Desired, para.amount1Desired] = [para.amount1Desired, para.amount0Desired];
    [para.amount0Min, para.amount1Min] = [para.amount1Min, para.amount0Min];
  }
  console.log("Mining NFT parameter: ")
  for (var i in para) { console.log("    " + i + ": " + para[i]);}

  //attach to manager
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = await positionManagerContract.attach(managerAddress);
      
  const tokenContract = await hre.ethers.getContractFactory("Token");


  if (para.approveFirst) {
    console.log(para.approveFirst)
  	console.log("First Approve ")

  	//get token0Contract
  	const token0Contract = await tokenContract.attach(para.token0Address);
  	//get token0 allowance
  	await token0Contract.approve(managerAddress, para.amount0Desired);
  	console.log("	" + await token0Contract.allowance(deployer.address, managerAddress));
  
  	//get token1Contract
  	const token1Contract = await tokenContract.attach(para.token1Address);
  	//get token1 allowance
  	await token1Contract.approve(managerAddress, para.amount1Desired);
  	console.log("	" + await token1Contract.allowance(deployer.address, managerAddress));
  }

  //mint nft
  const parameter = { 
      token0: para.token0Address, 
      token1: para.token1Address, 
      fee: para.fee, 
      tickLower: para.lowerTick, 
      tickUpper: para.upperTick, 
      amount0Desired: para.amount0Desired, 
      amount1Desired: para.amount1Desired, 
      amount0Min: para.amount0Min, 
      amount1Min: para.amount1Min, 
      recipient: deployer.address, 
      deadline: para.deadline};

  let tx;

  if (para.value > 0) {
    tx = await positionsManager.mint(parameter, {'value': para.value});
  } else {
    tx = await positionsManager.mint(parameter);
  }

  console.log(tx);
}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
