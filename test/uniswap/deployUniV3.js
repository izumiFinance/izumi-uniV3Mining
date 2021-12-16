
const { linkLibraries } = require("./utils/linkLibraries.js"); 
const artifacts = {                                                                                                                        
    UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
    UniswapV3Pool: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"),
    SwapRouter: require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"),
    NFTDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
    NonfungibleTokenPositionDescriptor: require("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
    NonfungiblePositionManager: require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
};

// deploy factory contract
async function deployFactory(signer) {
    const ContractFactory = await ethers.getContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, signer);
    const contract = await ContractFactory.deploy();

    await contract.deployed();
    return contract;
}

async function getPool(signer, poolAddr) {
  const ContractFactory = await ethers.getContractFactory(artifacts.UniswapV3Pool.abi, artifacts.UniswapV3Pool.bytecode, signer);
  const contract = ContractFactory.attach(poolAddr);
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

async function deployUniV3(wethAddr, signer) {
  const factory = await deployFactory(signer);
  const router = await deployRouter(factory.address, wethAddr, signer);
  const nftDescriptorLibrary = await deployNFTDescriptorLibrary(signer);
  const positionDescriptor = await deployPositionDescriptor(
    nftDescriptorLibrary.address,
    wethAddr,
    signer
  );
  const positionManager = await deployNonfungiblePositionManager(
    factory.address,
    wethAddr,
    positionDescriptor.address,
    signer
  );

  return {
      uniFactory: factory,
      uniSwapRouter: router,
      uniPositionManager: positionManager
  };
}


module.exports = {
    deployUniV3,
    getPool,
}