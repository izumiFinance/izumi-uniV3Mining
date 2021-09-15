const hre = require("hardhat");
const { UniswapV3Deployer } = require("node_modules/uniswap-v3-deploy-plugin/src/deployer/UniswapV3Deployer")

async function main() {
    const [actor] = await hre.ethers.getSigners();
    const contracts = await UniswapV3Deployer.deploy(actor);

    console.log(contracts);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
