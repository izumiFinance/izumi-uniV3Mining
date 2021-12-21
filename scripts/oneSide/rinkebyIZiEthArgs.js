const contracts = require("../deployed.js");

const nftManager = contracts.rinkeby.nftManager;
const uniTokenAddr = contracts.rinkeby.WETH9;
const lockTokenAddr = contracts.rinkeby.iZi;

const rewardToken = contracts.rinkeby.iZi;
const provider = '0xD4D6F030520649c7375c492D37ceb56571f768D0';
const rewardPerBlock = '15000000000000000000';
module.exports = [
    {
        uniV3NFTManager: nftManager,
        uniTokenAddr: uniTokenAddr,
        lockTokenAddr: lockTokenAddr,
        fee: 3000
    },
    [{
        rewardToken: rewardToken,
        provider: provider,
        accRewardPerShare: 0,
        rewardPerBlock: rewardPerBlock,
    }],
    1,
    contracts.rinkeby.iZi,
    9845999,
    20000000,
];