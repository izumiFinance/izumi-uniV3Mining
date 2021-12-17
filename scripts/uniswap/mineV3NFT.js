const {ethers} = require("hardhat");
const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const BigNumber = require('bignumber.js');

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const weth = contracts[net].WETH9


// Example: HARDHAT_NETWORK='izumiTest' node mingV3NFT.js 'USDC' 'USDT' 100 -276319 -276329 10000000000 10000000000

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],
    upperTick: v[5],
    lowerTick: v[6],
    amount0DesiredNoDecimal: v[7],
    amount1DesiredNoDecimal: v[8],
    amount0Min: 0,
    amount1Min: 0,
    deadline: '0xffffffff',
    value: 0,
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

//mint uniswap v3 nft
async function main() {

  // We get the contract to deploy
  if (para.token0Address.toLowerCase() > para.token1Address.toLowerCase()) {
	//console.log("The tokens are not correctly ordered, pleace check...")
    [para.token0Symbol, para.token1Symbol] = [para.token1Symbol, para.token0Symbol];
    [para.token0Address, para.token1Address] = [para.token1Address, para.token0Address];
    [para.amount0DesiredNoDecimal, para.amount1DesiredNoDecimal] = [para.amount1DesiredNoDecimal, para.amount0DesiredNoDecimal];
    [para.amount0Min, para.amount1Min] = [para.amount1Min, para.amount0Min];
  }

  var amount0Desired = await getNumNoDecimal(para.token0Address, para.amount0DesiredNoDecimal);
  var amount1Desired = await getNumNoDecimal(para.token1Address, para.amount1DesiredNoDecimal);
  console.log("Mining NFT parameter: ")
  for (var i in para) { console.log("    " + i + ": " + para[i]);}
  console.log('    amoutn0Desired: ', amount0Desired);
  console.log('    amount1Desired: ', amount1Desired);

  //attach to manager
  const [deployer, tester] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = positionManagerContract.attach(managerAddress);
  
  	console.log("First Approve ")

  	//get token0Contract
  	const token0Contract = await attachToken(para.token0Address);
  	//get token0 allowance
  	await token0Contract.connect(tester).approve(managerAddress, amount0Desired);
  	console.log("	" + await token0Contract.allowance(tester.address, managerAddress));
  
  	//get token1Contract
  	const token1Contract = await attachToken(para.token1Address);
  	//get token1 allowance
  	await token1Contract.connect(tester).approve(managerAddress, amount1Desired);
  	console.log("	" + await token1Contract.allowance(tester.address, managerAddress));

  //mint nft
  const parameter = { 
      token0: para.token0Address, 
      token1: para.token1Address, 
      fee: para.fee, 
      tickLower: para.lowerTick, 
      tickUpper: para.upperTick, 
      amount0Desired: amount0Desired, 
      amount1Desired: amount1Desired, 
      amount0Min: para.amount0Min, 
      amount1Min: para.amount1Min, 
      recipient: tester.address, 
      deadline: para.deadline};

  let tx;

  if (para.token0Address === weth) {
    para.value = amount0Desired;
  }
  if (para.token1Address === weth) {
    para.value = amount1Desired;
  }

  if (para.value > 0) {
    tx = await positionsManager.connect(tester).mint(parameter, {'value': para.value});
  } else {
    tx = await positionsManager.connect(tester).mint(parameter);
  }

  console.log(tx);
}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
