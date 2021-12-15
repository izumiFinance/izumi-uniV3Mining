const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

async function attachContract(address) {
    var contractFactory = await hardhat.ethers.getContractFactory("MiningFixRangeBoost");
    var contract = contractFactory.attach(address);
    return contract;
}
async function attachToken(address) {
    var contractFactory = await hardhat.ethers.getContractFactory("TestToken");
    var contract = contractFactory.attach(address);
    return contract;
}

async function getRewardInfo(mining, idx) {
    var rewardToken, provider, accRewardPerShare, rewardPerBlock;
    [rewardToken, provider, accRewardPerShare, rewardPerBlock] = await mining.rewardInfos(idx);
    return {
        rewardToken: rewardToken,
        provider: provider,
        accRewardPerShare: accRewardPerShare,
        rewardPerBlock: rewardPerBlock.toString()
    }
}

async function main() {
    const contractAddr = '0x263B272A99127ad57cff73AA9c04C515007bFb6f';
    const contract = await attachContract(contractAddr);

    const [deployer] = await hardhat.ethers.getSigners();
    
    const rewardInfosLen = await contract.rewardInfosLen();
    console.log('rewardInfosLen: ', rewardInfosLen);

    var rewardInfo0 = await getRewardInfo(contract, 0);
    var rewardInfo1 = await getRewardInfo(contract, 1);
    console.log(rewardInfo0);
    console.log(rewardInfo1);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
