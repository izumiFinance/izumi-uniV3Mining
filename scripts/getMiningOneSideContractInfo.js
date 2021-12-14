const hardhat = require("hardhat");
const contracts = require("./deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;


async function main() {
    
  const [deployer] = await hardhat.ethers.getSigners();

  console.log("Paramters: ");
  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");
  const mining = await Mining.attach("0xB21F1fDcBB46302918a6304B80fEa855deE4B193");

  var uniToken, lockToken, fee, lockBoostMultiplier, iziTokenAddr;
  [uniToken, lockToken, fee, lockBoostMultiplier, iziTokenAddr] = await mining.getMiningContractInfo();
  console.log(iziTokenAddr);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
