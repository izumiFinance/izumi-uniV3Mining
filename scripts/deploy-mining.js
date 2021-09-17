const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const managerAddress = contracts.nftManger;


// example
// HARDHAT_NETWORK='izumi_test' node deployMining.js 'USDT' 'USDC' 500 '10000000000000000000' 50000 0 0 1000000  'RDT'
// 
//
const v = process.argv


const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
    rewardPerBlock: v[5],
    rewardUpperTick: v[6],
    rewardLowerTick: v[7],
    startBlock: v[8],
    endBlock: v[9],
    rewardTokenSymbol: v[10],
    rewardTokenAddress: contracts[v[10]],
}


async function main() {
  // We get the contract to deploy
  if (para.token0Address > para.token1Address) {
      [para.token0Symbol, para.token1Symbol] = [para.token1Symbol, para.token0Symbol];
      [para.token0Address, para.token1Address] = [para.token1Address, para.token0Address];
  }

  console.log("Deploy Minging Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("Mining");

  console.log("Deploying .....")
  const mining = await Mining.deploy(
    managerAddress, 
    para.token0Address, 
    para.token1Address, 
    para.fee, 
    para.rewardTokenAddress, 
    para.rewardPerBlock, 
    para.rewardUpperTick, 
    para.rewardLowerTick, 
    para.startBlock, 
    para.endBlock
  );
  await mining.deployed();
  console.log("Mining Contract Address: " , mining.address);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
