const contracts = require("../../deployed.js");

const nftManager = contracts.ethereum.nftManager;
const uniTokenAddr = contracts.ethereum.WETH9;
const lockTokenAddr = contracts.ethereum.YIN;

const rewardToken0 = contracts.ethereum.iZi;
const provider0 = contracts.ethereum.iZi_PROVIDER;
const rewardPerBlock0 = '4000000000000000000';

const rewardToken1 = contracts.ethereum.YIN;
const provider1 = contracts.ethereum.YIN_PROVIDER;
const rewardPerBlock1 = '500000000000000000';

module.exports = [
    {
        uniV3NFTManager: nftManager,
        uniTokenAddr: uniTokenAddr,
        lockTokenAddr: lockTokenAddr,
        fee: 3000
    },
    [{
        rewardToken: rewardToken0,
        provider: provider0,
        accRewardPerShare: 0,
        rewardPerBlock: rewardPerBlock0,
    },{
        rewardToken: rewardToken1,
        provider: provider1,
        accRewardPerShare: 0,
        rewardPerBlock: rewardPerBlock1,
    }],
    1,
    contracts.ethereum.iZi,
    13949864,
    14135006,
];