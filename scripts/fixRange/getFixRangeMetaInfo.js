const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require("bignumber.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node scripts/fixRange/getFixRangeMetaInfo.js \
//     'FIXRANGE_USDC_USDT_100'
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
}
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
        accRewardPerShare: accRewardPerShare.toString(),
        rewardPerBlock: rewardPerBlock.toString()
    }
}

async function getMiningContractInfo(mining) {
    var token0, token1, fee, rewardInfos, iziTokenAddr, rewardUpperTick, rewardLowerTick, lastTouchBlock, totalVLiquidity, startBlock, endBlock;
    [token0, token1, fee, rewardInfos, iziTokenAddr, rewardUpperTick, rewardLowerTick, lastTouchBlock, totalVLiquidity, startBlock, endBlock] = await mining.getMiningContractInfo();
    lastTouchBlock = lastTouchBlock.toString();
    totalVLiquidity = totalVLiquidity.toString();
    startBlock = startBlock.toString();
    endBlock = endBlock.toString();
    return {
        token0,
        token1,
        fee,
        // rewardInfos,
        iziTokenAddr,
        rewardLowerTick,
        rewardUpperTick,
        lastTouchBlock,
        totalVLiquidity,
        startBlock,
        endBlock
    };
}

async function main() {
    const contract = await attachContract(para.miningPoolAddr);

    const [deployer] = await hardhat.ethers.getSigners();
    
    let rewardInfosLen = await contract.rewardInfosLen();
    
    rewardInfosLen = Number(rewardInfosLen.toString());
    console.log('rewardInfosLen: ', rewardInfosLen);

    for (var i = 0; i < rewardInfosLen; i ++) {
        var rewardInfo = await getRewardInfo(contract, i);
        console.log('rewardInfo: ', rewardInfo);
    }

    var contractInfo = await getMiningContractInfo(contract);
    console.log('contractInfo: ', contractInfo);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
