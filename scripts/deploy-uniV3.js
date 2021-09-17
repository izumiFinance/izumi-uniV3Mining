// This script deploys Uniswap V3 with ethers
// `npx hardhat run scripts/deploy-uniV3.js`

const { Signer, Contract, ContractFactory } = require("ethers"); 
const hre = require("hardhat");
const { WETH9 } = require("../util/WETH9.json");
const { linkLibraries } = require("../util/linkLibraries.js"); 
const fs = require('fs');

const artifacts = {                                                                                                                        
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),                                                              
  SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),                                                                           
  NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),                                                        
  NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),   
  NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),                           
  WETH9,
};

// deploy weth9 contract using abi and bytecode from "../util/WETH9.json"
async function deployWETH9(signer) {
  const ContractFactory = await ethers.getContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, signer);
  const contract = await ContractFactory.deploy();

  await contract.deployed();
  return contract;
}

// deploy factory contract
async function deployFactory(signer) {
  const ContractFactory = await ethers.getContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, signer);
  const contract = await ContractFactory.deploy();

  await contract.deployed();
  return contract;
}

// deploy router contract
async function deployRouter(factoryAddress, weth9Address, signer) {
  const ContractFactory = await ethers.getContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, signer);
  const contract = await ContractFactory.deploy(factoryAddress, weth9Address);

  await contract.deployed();
  return contract;
}

// deploy nftDescriptorLibrary contract
async function deployNFTDescriptorLibrary(signer) {
  const ContractFactory = await ethers.getContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, signer);
  const contract = await ContractFactory.deploy();

  await contract.deployed();
  return contract;
}

// deploy positionDescriptor contract
async function deployPositionDescriptor(nftDescriptorLibraryAddress, weth9Address, signer) {
  const linkedBytecode = linkLibraries(
    {                      
      bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
      linkReferences: {
        "NFTDescriptor.sol": {                                                      
          NFTDescriptor: [                                                          
            {
              length: 20,
              start: 1261,                                                                                                                                                 
            },
          ],
        },
      },
    },
    {
      NFTDescriptor: nftDescriptorLibraryAddress,
    }
  );
  const ContractFactory = await ethers.getContractFactory(artifacts.NonfungibleTokenPositionDescriptor.abi, linkedBytecode, signer);
  const contract = await ContractFactory.deploy(weth9Address);

  await contract.deployed();
  return contract;
}

// deploy positionManager contract
async function deployNonfungiblePositionManager(factoryAddress, weth9Address, positionDescriptorAddress, signer) {
  const ContractFactory = await ethers.getContractFactory(artifacts.NonfungiblePositionManager.abi, artifacts.NonfungiblePositionManager.bytecode, signer);
  const contract = await ContractFactory.deploy(factoryAddress, weth9Address, positionDescriptorAddress);

  await contract.deployed();
  return contract;
}

async function deployUniV3() {
  const [signer] = await hre.ethers.getSigners();

  const weth9 = await deployWETH9(signer);
  const factory = await deployFactory(signer);
  const router = await deployRouter(factory.address, weth9.address, signer);
  const nftDescriptorLibrary = await deployNFTDescriptorLibrary(signer);
  const positionDescriptor = await deployPositionDescriptor(
    nftDescriptorLibrary.address,
    weth9.address,
    signer
  );
  const positionManager = await deployNonfungiblePositionManager(
    factory.address,
    weth9.address,
    positionDescriptor.address,
    signer
  );
  console.log("weth9: ", weth9.address);
  console.log("factory: ", factory.address);
  console.log("router: ", router.address);
  console.log("nftDescriptorLibrary: ", nftDescriptorLibrary.address);
  console.log("positionDescriptor: ", positionDescriptor.address);
  console.log("positionManager: ", positionManager.address);
  let deployed = {
    'weth9': weth9.address,
    'factory': factory.address,
    'router': router.address,
    'nftDescriptorLibrary': nftDescriptorLibrary.address,
    'positionDescriptor': positionDescriptor.address,
    'positionManager': positionManager.address
  }
  let data = JSON.stringify(deployed, null, 2);
  fs.writeFileSync('deployed.json', data);
  return {
    weth9,
    factory,
    router,
    nftDescriptorLibrary,
    positionDescriptor,
    positionManager,
  };
}

deployUniV3()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

module.exports = {
  deployUniV3
}
