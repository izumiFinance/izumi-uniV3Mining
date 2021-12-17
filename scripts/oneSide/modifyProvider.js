const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyProvider.js \
//     'ONESIDE_WETH9_IZI_3000' 
//     0
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    rewardIdx: v[3],
}

async function getRewardInfo(mining, idx) {
    var rewardToken, provider, accRewardPerShare, rewardPerBlock;
    [rewardToken, provider, accRewardPerShare, rewardPerBlock] = await mining.rewardInfos(idx);
    return {
        rewardToken: rewardToken,
        provider: provider,
        accRewardPerShare: accRewardPerShare.toString(),
        rewardPerBlock: rewardPerBlock.toString()
    };
}

async function attachToken(address) {
    var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
    var token = tokenFactory.attach(address);
    return token;
}
async function main() {
    
  const [deployer, tester, newProvider] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoost");
  const mining = Mining.attach(para.miningPoolAddr);

  var rewardInfo = await getRewardInfo(mining, para.rewardIdx);
  console.log('rewardInfo: ', rewardInfo);
  var token = await attachToken(rewardInfo.rewardToken);
  await token.connect(newProvider).approve(mining.address, '1000000000000000000000000000000');

  tx = await mining.modifyProvider(para.rewardIdx, newProvider.address);
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
