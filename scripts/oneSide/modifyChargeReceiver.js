const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyProvider.js \
//     'ONESIDE_WETH9_IZI_3000' 
//     0xF18Cd1621574e1E123D694FCdCc2EB8e8038a2d0
const v = process.argv
const net = process.env.HARDHAT_NETWORK


function getAddress(symbolOrAddress) {
  const prefix = symbolOrAddress.slice(0, 2);
  if (prefix.toLowerCase() === '0x') {
    return symbolOrAddress;
  }
  return contracts[net][symbolOrAddress];
}

const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: getAddress(v[2]),
    receiver: getAddress(v[3]),
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
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  console.log('current deployer: ', deployer.address);

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  const originChargeReciever = await mining.chargeReceiver();
  console.log('origin charge receiver: ', originChargeReciever);

  console.log('new charge receiver:' , para.receiver);

  try {
    tx = await mining.modifyChargeReceiver(para.receiver);
    console.log('tx: ', tx);
  } catch(err) {
    console.log('err: ', err);
  }

  const currentChargeReciever = await mining.chargeReceiver();
  console.log('current charge receiver: ', currentChargeReciever);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
