
const { checkProperties } = require("@ethersproject/properties");
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const hardhat = require('hardhat');
const { ethers } = require("hardhat");;

var uniV3 = require("./uniswap/deployUniV3.js");
var weth9 = require('./uniswap/deployWETH9.js');

async function getToken() {

  // deploy token
  const tokenFactory = await ethers.getContractFactory("TestToken")
  token = await tokenFactory.deploy('a', 'a', 18);
  await token.deployed();
  return token;
}

function decimal2Amount(amountDecimal, decimal) {
    return new BigNumber(amountDecimal).times(10**decimal).toFixed(0);
}

function stringDiv(a, b) {
    let an = new BigNumber(a);
    an = an.minus(an.mod(b));
    return an.div(b).toFixed(0, 3);
}

function stringMul(a, b) {
    let an = new BigNumber(a);
    an = an.times(b);
    return an.toFixed(0, 3);
}

function stringMinus(a, b) {
    let an = new BigNumber(a);
    an = an.minus(b);
    return an.toFixed(0, 3);
}

function stringAdd(a, b) {
    let an = new BigNumber(a);
    an = an.plus(b);
    return an.toFixed(0, 3);
}

function stringMin(a, b) {
    const an = new BigNumber(a);
    const bn = new BigNumber(b);
    if (an.gte(bn)) {
        return b;
    }
    return a;
}

function updateTotalValidVeiZi(totalValidVeiZi, originValidVeiZi, veiZi, vLiquidity, totalVLiquidity) {
    const originTotalValidVeiZi = stringMinus(totalValidVeiZi, originValidVeiZi);
    const mul = stringMul(stringMul('2', originTotalValidVeiZi), vLiquidity);
    const validVeiZi = stringMin(veiZi, stringDiv(mul, totalVLiquidity));
    const newTotalValidVeiZi = stringAdd(originTotalValidVeiZi, validVeiZi);
    return {
        totalValidVeiZi: newTotalValidVeiZi,
        validVeiZi,
    };
}

async function waitUntilJustBefore(destBlockNumber) {
    let currentBlockNumber = await ethers.provider.getBlockNumber();
    while (currentBlockNumber < destBlockNumber - 1) {
        await ethers.provider.send('evm_mine');
        currentBlockNumber = await ethers.provider.getBlockNumber();
    }
    return currentBlockNumber;
}

async function getTokenBalance(tokenMap, tester) {
    const balance = {};
    for (key in tokenMap) {
        token = tokenMap[key];
        balance[key] = (await token.balanceOf(tester.address)).toString();
    }
    return balance;
}

async function getCollectReward(tokenMap, mining, tester) {
    const beforeBalance = await getTokenBalance(tokenMap, tester);
    const tx = await mining.connect(tester).collectAllTokens();
    const afterBalance = await getTokenBalance(tokenMap, tester);
    const reward = {};
    for (const key in tokenMap) {
        reward[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return reward;
}

function checkStringNumberNearlyEqual(a, b, cutLen = 6) {
    const acut = a.slice(0, a.length - cutLen);
    const bcut = b.slice(0, b.length - cutLen);
    expect(acut).to.equal(bcut);
}

async function getStakingInfo(veiZi, user) {
    const stakingInfo = (await veiZi.stakingInfo(user));
    return {
        nftId: stakingInfo.nftId.toString(),
        stakingId: stakingInfo.stakingId.toString(),
        amount: stakingInfo.amount.toString(),
    };
}

function getValidVLiquidity(vLiquidity, totalVLiquidity, veiZi, totalValidVeiZi) {
    if (totalValidVeiZi === '0') {
        return vLiquidity;
    }
    const baseVLiquidity = stringDiv(stringMul(vLiquidity, '4'), '10');
    const advanceVLiquidity = stringDiv(stringMul(stringDiv(stringMul(totalVLiquidity, veiZi), totalValidVeiZi), '6'), '10');
    const veiZiVLiquidity = stringAdd(baseVLiquidity, advanceVLiquidity);
    return stringMin(veiZiVLiquidity, vLiquidity);
}

describe("test uniswap price oracle", function () {

    var signer, tester, receiver, provider;
    var iZi;
    var USDC;
    var veiZi;
    var mining;
    var BIT;
    var hugeAmount;
    var iZiRewardPerBlock, BITRewardPerBlock;
    var rewardPerBlockMap;

    beforeEach(async function() {

        hugeAmount = '1000000000000000000000000000000';
      
        [signer, tester, miner, receiver, provider] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        USDC = await tokenFactory.deploy('USDC', 'USDC', 6);
        BIT = await tokenFactory.deploy('BIT', 'BIT', 18);

        iZi = await tokenFactory.deploy('iZi', 'iZi', 18);

        console.log('izi: ', iZi.address);
        console.log('usdc: ', USDC.address);

        const veiZiFactory = await ethers.getContractFactory('TestVeiZi');
        veiZi = await veiZiFactory.deploy();

        iZi.connect(tester).approve(veiZi.address, hugeAmount);
        iZi.mint(tester.address, hugeAmount);
        

        const weth = await weth9.deployWETH9(signer);
        const wethAddr = weth.address;

        const deployed = await uniV3.deployUniV3(wethAddr, signer);

        const uniPositionManager = deployed.uniPositionManager;
        const priceiZiByUSDCDecimal = 0.5;
        const priceiZiByUSDCSqrt = BigNumber(priceiZiByUSDCDecimal).times(10 ** 6).div(10 ** 18).sqrt();
        if (USDC.address.toLowerCase() < iZi.address.toLowerCase()) {
            const priceUSDCByiZiSqrt = BigNumber(1).div(priceiZiByUSDCSqrt);
            const priceUSDCByiZiSqrtX96 = priceUSDCByiZiSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(USDC.address, iZi.address, '3000', priceUSDCByiZiSqrtX96);
        } else {
            const priceiZiByUSDCSqrtX96 = priceiZiByUSDCSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(iZi.address, USDC.address, '3000', priceiZiByUSDCSqrtX96);
        }
        let blockNumber = await ethers.provider.getBlockNumber();
        iZiRewardPerBlock = BigNumber((10 ** 17)).toFixed(0);
        BITRewardPerBlock = BigNumber((10 ** 16)).times(2).toFixed(0);
        rewardPerBlockMap = {
            'iZi': iZiRewardPerBlock,
            'BIT': BITRewardPerBlock,
        };
        const args = [
            {
                uniV3NFTManager: uniPositionManager.address,
                uniTokenAddr: USDC.address,
                lockTokenAddr: iZi.address,
                fee: '3000'
            },
            [
                {
                    rewardToken: iZi.address,
                    provider: provider.address,
                    accRewardPerShare: 0,
                    rewardPerBlock: iZiRewardPerBlock,
                },
                {
                    rewardToken: BIT.address,
                    provider: provider.address,
                    accRewardPerShare: 0,
                    rewardPerBlock: BITRewardPerBlock,
                }
            ],
            '1',
            veiZi.address,
            blockNumber, blockNumber + 10000,
            '40',
            receiver.address,
            BigNumber(10000).times(10 ** 18).toFixed(0)
        ];

        const MiningFactory = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
        mining = await MiningFactory.deploy(...args);
        await BIT.mint(provider.address, hugeAmount);
        await iZi.mint(provider.address, hugeAmount);
        await BIT.connect(provider).approve(mining.address, hugeAmount);
        await iZi.connect(provider).approve(mining.address, hugeAmount);

        await USDC.mint(tester.address, hugeAmount);
        await USDC.connect(tester).approve(mining.address, hugeAmount);
        await iZi.mint(tester.address, hugeAmount);
        await iZi.connect(tester).approve(mining.address, hugeAmount);

        // a big miner
        await USDC.mint(miner.address, hugeAmount);
        await USDC.connect(miner).approve(mining.address, hugeAmount);
        await iZi.mint(miner.address, hugeAmount);
        await iZi.connect(miner).approve(mining.address, hugeAmount);

        // miner mint veiZi
        blockNumber = await ethers.provider.getBlockNumber();
        const MAXTIME = await veiZi.MAXTIME();
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);

        await mining.connect(miner).depositWithuniToken(decimal2Amount(15000, 6), '0xffffffff');
        await mining.connect(tester).depositWithuniToken(decimal2Amount(1000, 6), '0xffffffff');
        await mining.connect(tester).depositWithuniToken(decimal2Amount(500, 6), '0xffffffff');
    });

    it("check user status", async function() {
        const userStatus = await mining.userStatus(tester.address);
        const vLiquidity = userStatus.vLiquidity.toString();
        expect(vLiquidity).to.equal('1500');
        const validVLiquidity = userStatus.validVLiquidity.toString();
        expect(validVLiquidity).to.equal('600'); // 1500 * 0.4
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        expect(totalVLiquidity).to.equal('16500');
    });
    
    it("check reward", async function () {
        
        let userStatus = await mining.userStatus(tester.address);
        let validVLiquidity = userStatus.validVLiquidity.toString();
        let totalVLiquidity = (await mining.totalVLiquidity()).toString();
        
        let blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 3);
        const rewardMap = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);

        for (const key in rewardMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('3', stringMul(rewardPerBlock, validVLiquidity)), totalVLiquidity);
            checkStringNumberNearlyEqual(rewardMap[key], reward);
        }

        userStatus = await mining.userStatus(tester.address);
        vLiquidity = userStatus.vLiquidity.toString();
        expect(vLiquidity).to.equal('1500');
        validVLiquidity = userStatus.validVLiquidity.toString();
        expect(validVLiquidity).to.equal('600'); // 1500 * 0.4
    });


    it("check reward after staking veizi", async function () {
        
        const userStatus0 = await mining.userStatus(tester.address);
        const validVLiquidity0 = userStatus0.validVLiquidity.toString();
        const totalVLiquidity0 = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi0 = (await mining.totalValidVeiZi()).toString();
        const MAXTIME = Number((await veiZi.MAXTIME()).toString());
        
        let blockNumber = await ethers.provider.getBlockNumber();
        await veiZi.connect(tester).stake('2', decimal2Amount(10000, 18), blockNumber + MAXTIME);

        await waitUntilJustBefore(blockNumber + 3);
        const rewardMap1 = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo1 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardMap1) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('3', stringMul(rewardPerBlock, validVLiquidity0)), totalVLiquidity0);
            checkStringNumberNearlyEqual(rewardMap1[key], reward);
        }

        // but userStatus changed
        const totalVLiquidity1 = totalVLiquidity0;
        const userStatus1 = await mining.userStatus(tester.address);
        const validVeiZiData1 = updateTotalValidVeiZi(totalValidVeiZi0, '0', stakingInfo1.amount, userStatus1.vLiquidity.toString(), totalVLiquidity1);
        const expectTotalValidVeiZi1 = validVeiZiData1.totalValidVeiZi;

        const totalValidVeiZi1 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi1).to.equal(expectTotalValidVeiZi1);

        const expectValidVeiZi1 = validVeiZiData1.validVeiZi;
        expect(userStatus1.validVeiZi.toString()).to.equal(expectValidVeiZi1);

        const vLiquidity1 = userStatus1.vLiquidity.toString();
        expect(vLiquidity1).to.equal('1500');
        const expectValidVLiquidity1 = getValidVLiquidity(vLiquidity1, totalVLiquidity1, stakingInfo1.amount, totalValidVeiZi1);
        const validVLiquidity1 = userStatus1.validVLiquidity.toString();
        expect(validVLiquidity1).to.equal(expectValidVLiquidity1);

        // collect again
        blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 5);
        const rewardMap2 = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo2 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardMap2) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('5', stringMul(rewardPerBlock, validVLiquidity1)), totalVLiquidity1);
            checkStringNumberNearlyEqual(rewardMap2[key], reward);
        }

        // userStatus changed again
        const totalVLiquidity2 = totalVLiquidity1;
        const userStatus2 = await mining.userStatus(tester.address);
        const validVeiZiData2 = updateTotalValidVeiZi(totalValidVeiZi1, validVeiZiData1.validVeiZi, stakingInfo2.amount, userStatus2.vLiquidity.toString(), totalVLiquidity2);
        const expectTotalValidVeiZi2 = validVeiZiData2.totalValidVeiZi;

        const totalValidVeiZi2 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi2).to.equal(expectTotalValidVeiZi2);

        const expectValidVeiZi2 = validVeiZiData2.validVeiZi;
        expect(userStatus2.validVeiZi.toString()).to.equal(expectValidVeiZi2);

        const vLiquidity2 = userStatus2.vLiquidity.toString();
        expect(vLiquidity2).to.equal('1500');
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });

});