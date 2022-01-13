const contracts = require("../../deployed.js");

const nftManager = contracts.polygon.nftManager;
const uniTokenAddr = contracts.polygon.ETHT;
const lockTokenAddr = contracts.polygon.iZiT;

const rewardToken = contracts.polygon.iZiT;
const provider = contracts.polygon.iZiT_PROVIDER;
const rewardPerBlock = '2000000000000000000';


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
    contracts.polygon.iZi,
    23591793,
    25591793,
    1,
    30,
    '0x3E8aE53D96006bd4c8462eDAFb4Fb8364007E744',
];