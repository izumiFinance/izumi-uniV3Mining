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

async function main() {
    const contractAddr = '0x9713079519A7A8d9DBf3d18786EFC08AB811267b';
    const contract = await attachContract(contractAddr);

    const [deployer] = await hardhat.ethers.getSigners();
    var nftIds = await contract.getTokenIds(deployer.address);
    nftIds = nftIds.map((id)=>id.toString());

    console.log(nftIds);

    console.log(await contract.rewardInfosLen());
    rewardInfo = await contract.rewardInfos("0");
    console.log('reward: ', (await contract.pendingReward("336")).toString());

    var rewardToken = await attachToken(rewardInfo.rewardToken);
    console.log('approve: ', (await rewardToken.allowance(rewardInfo.provider, contractAddr)).toString());

    var tx = await contract.withdraw("336");
    console.log(tx);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
