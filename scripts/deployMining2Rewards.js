const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const managerAddress = contracts.nftManger;


// example
// HARDHAT_NETWORK='izumi_test' node deployMining2Rewards.js 'WETH9' 'USDC' 3000 '10000000000000000000' '1000000000000000000' 90000 70000 0 1000000  'RDT' 'RDT2'
// 
//
const v = process.argv


const para = {
    token0Symbol: v[2],
    token0Address: contracts[v[2]],
    token1Symbol: v[3],
    token1Address: contracts[v[3]],
    fee: v[4],
    rewardPerBlock0: v[5],
    rewardPerBlock1: v[6],
    rewardUpperTick: v[7],
    rewardLowerTick: v[8],
    startBlock: v[9],
    endBlock: v[10],
    rewardTokenSymbol0: v[11],
    rewardTokenSymbol1: v[12],
    rewardTokenAddress0: contracts[v[11]],
    rewardTokenAddress1: contracts[v[12]],
}


async function main() {
  // We get the contract to deploy
  if (para.token0Address.toLowerCase() > para.token1Address.toLowerCase()) {
      [para.token0Symbol, para.token1Symbol] = [para.token1Symbol, para.token0Symbol];
      [para.token0Address, para.token1Address] = [para.token1Address, para.token0Address];
      [para.rewardUpperTick, para.rewardLowerTick] = [-para.rewardLowerTick, -para.rewardUpperTick];
  }

  console.log("Deploy Minging2Rewards Contract: %s/%s", para.token0Symbol,  para.token1Symbol);
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  const Mining = await hardhat.ethers.getContractFactory("Mining2R");

  console.log("Deploying .....")
  const mining = await Mining.deploy(
    managerAddress, 
    para.token0Address, 
    para.token1Address, 
    para.fee, 
    para.rewardTokenAddress0, 
    para.rewardTokenAddress1, 
    para.rewardPerBlock0, 
    para.rewardPerBlock1, 
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
