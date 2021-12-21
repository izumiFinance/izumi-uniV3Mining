const contracts = require("../deployed.js");

const nftManager = contracts.ethereum.nftManager;
const usdc = contracts.ethereum.USDC;
const usdt = contracts.ethereum.USDT;

const rewardToken = contracts.ethereum.iZi;
const iZiAddr = contracts.ethereum.iZi;
const provider = '0xee264e74A2Fd2c7A55da705b80e092f05DaE5b5D';
const rewardPerBlock = '15000000000000000000';
module.exports = [
    nftManager,
    usdc,
    usdt,
    100,
    [{
      rewardToken: rewardToken,
      provider: provider,
      accRewardPerShare: 0,
      rewardPerBlock: rewardPerBlock,
    }],
    iZiAddr,
    -10,
    10,
    13846789, 14025760
];