const {ethers} = require("hardhat");
const hre = require("hardhat");
const factoryJson = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
const poolJson = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");
const managerJson = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

const USDT = "0xDa12894F72D5e302138Da6d356aAF8eD1df4d0C7";
const USDC = "0xa5ecCB4d91d2c306a6b1f2F9820986feA80aAc8d"; 
const DAI = "0x66Cb3A984F2B0111F5c71084023bf89b4Bc1F1e2";
const WETH9 = "0x959a66DF1b53851e9CbdA9C7012cCc211Fb0Dc0A";
const factoryAddress = "0xe560FE66E8F714d94e1A6aA35Ecfbd51144194EE";
const managerAddress = "0xC6a069A7F614B74aff311012D32A6AF0Bf5EC0c4";


async function createPool(token0, token1, fee, priceSqrtX96) {
  const [deployer] = await ethers.getSigners();
  const managerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const manager = await managerContract.attach(managerAddress);
  const tx = await manager.createAndInitializePoolIfNecessary(token0, token1, fee, priceSqrtX96);
  console.log(tx.hash);
  //console.log(tx);
}

async function getPool(token0, token1, fee) {
  const [deployer] = await ethers.getSigners();
  const factoryContract = await ethers.getContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
  const factory = await factoryContract.attach(factoryAddress);
  
  let pool = await factory.getPool(token0, token1, fee);
  console.log(pool);
  return pool;
}

async function getSlot0FromPool() {
  const [deployer] = await ethers.getSigners();
  const poolAddress = await getPool(USDT, DAI, 500);
  console.log("pool: ", poolAddress);
  const poolContract = await ethers.getContractFactory(poolJson.abi, poolJson.bytecode, deployer);
  const pool = await poolContract.attach(poolAddress);
  console.log(await pool.token0(), await pool.token1());
  const slot0 = await pool.slot0();
  console.log(slot0);
  return slot0;
}

async function mintV3NFT() {
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = positionManagerContract.attach(managerAddress);
  
  const tokenContract = await hre.ethers.getContractFactory("Token");
  const usdt = tokenContract.attach(USDT);

  await usdt.approve(managerAddress, '10000000000000000000000');
  console.log(await usdt.allowance(deployer.address, managerAddress));
  
  const usdc = tokenContract.attach(USDC);
  await usdc.approve(managerAddress, '10000000000000000000000');

  const dai = tokenContract.attach(DAI);
  await dai.approve(managerAddress, '10000000000000000000000');

  // console.log(await usdc.allowance(deployer.address, managerAddress));

  //const parameter = { token0: USDT, token1: WETH9, fee: 3000, tickLower: -100, tickUpper: 100, amount0Desired: '100000000000000000000', amount1Desired: '100000000000000000000', amount0Min: 0, amount1Min: 0, recipient: deployer.address, deadline: '1000000000000000000000'};
  const parameter = { token0: USDT, token1: USDC, fee: 500, tickLower: -100, tickUpper: 100, amount0Desired: '100000000000000000000', amount1Desired: '100000000000000000000', amount0Min: 0, amount1Min: 0, recipient: deployer.address, deadline: '1000000000000000000000'};
  console.log(parameter);
  const tx = await positionsManager.mint(parameter);
  console.log(tx);
}

async function tokenURI() {
  const [deployer] = await ethers.getSigners();
  const positionManagerContract = await ethers.getContractFactory(managerJson.abi, managerJson.bytecode, deployer);
  const positionsManager = positionManagerContract.attach(managerAddress);

  const uri = await positionsManager.tokenURI(1);
  console.log(uri);
}

createPool(USDT, USDC, 500, '79228162514264337593543950336').then(() => process.exit(0)).catch((error) => {console.error(error); process.exit(1);})
//createPool(USDC, WETH9, 3000, '4425888021996141170433613000000').then(() => process.exit(0)).catch((error) => {console.error(error); process.exit(1);})
// getPool(USDC, WETH9, 3000).then(() => process.exit(0)).catch((error) => {console.error(error); process.exit(1);})

//getSlot0FromPool();
//mintV3NFT();
//tokenURI();
