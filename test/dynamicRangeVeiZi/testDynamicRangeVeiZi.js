
const { checkProperties } = require("@ethersproject/properties");
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const hardhat = require('hardhat');
const { ethers } = require("hardhat");;

var uniV3 = require("../uniswap/deployUniV3.js");
var weth9 = require('../uniswap/deployWETH9.js');
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
const UniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json");

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

function stringLTE(a, b) {
    const an = new BigNumber(a);
    const bn = new BigNumber(b);
    return an.lte(bn);
}

function stringGT(a, b) {
    const an = new BigNumber(a);
    const bn = new BigNumber(b);
    return an.gt(bn);
}

function stringAbs(a) {
    const an = new BigNumber(a);
    if (an.lt(0)) {
        return an.times('-1').toFixed(0);
    }
    return an.toFixed(0);
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

async function withdrawAndComputeBalanceDiff(tokenMap, mining, tester, nftId) {
    const beforeBalance = await getTokenBalance(tokenMap, tester);
    const tx = await mining.connect(tester).withdraw(nftId, false);
    const afterBalance = await getTokenBalance(tokenMap, tester);
    const delta = {};
    for (const key in tokenMap) {
        delta[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return delta;
}

async function addLiquidityAndComputeBalanceDiff(tokenMap, mining, tester, amount0, amount1) {
    const beforeBalance = await getTokenBalance(tokenMap, tester);
    const oraclePrice = await mining.getOraclePrice();
    const avgTick = oraclePrice.avgTick;
    const tx = await mining.connect(tester).deposit(amount0, amount1, avgTick);
    const afterBalance = await getTokenBalance(tokenMap, tester);
    const delta = {};
    for (const key in tokenMap) {
        delta[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return delta;
}

async function getTokenStatus(mining, nftId) {
    const tokenStatus = await mining.tokenStatus(nftId);
    return {
        nftId: tokenStatus.nftId.toString(),
        uniLiquidity: tokenStatus.uniLiquidity.toString(),
        vLiquidity: tokenStatus.vLiquidity.toString(),
        amount0: tokenStatus.amount0.toString(),
        amount1: tokenStatus.amount1.toString()
    };
}

async function getPosition(uniPositionManager, nftId) {
    const position = await uniPositionManager.positions(nftId);
    return {
        tickLower: Number(position.tickLower),
        tikcUpper: Number(position.tikcUpper),
        liquidity: position.liquidity.toString(),
    };
}

async function getUniswapWithdrawTokenAmount(uniPositionManager, nftId, liquidity) {
    const owner = await uniPositionManager.ownerOf(nftId);
    const managerWeb3 = new web3.eth.Contract(NonfungiblePositionManager.abi, uniPositionManager.address);
    const decreaseRet = await managerWeb3.methods.decreaseLiquidity({
        tokenId: nftId,
        liquidity: liquidity,
        amount0Min: '0',
        amount1Min: '0',
        deadline: '0xffffffff',
    }).call({from: owner});
    const amount0 = decreaseRet.amount0.toString();
    const amount1 = decreaseRet.amount1.toString();
    return {amount0, amount1};
}


function checkStringNumberNearlyEqual(a, b, delta = '100') {
    const c = stringMinus(a, b);
    const absC = stringAbs(c);
    expect(stringLTE(absC, delta)).to.equal(true);
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
    var uniPositionManager;
    var token0Decimal, token1Decimal;
    var token0Symbol, token1Symbol;

    beforeEach(async function() {

        hugeAmount = '1000000000000000000000000000000';
      
        [signer, tester, miner, receiver, provider] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        USDC = await tokenFactory.deploy('USDC', 'USDC', 6);
        BIT = await tokenFactory.deploy('BIT', 'BIT', 18);

        iZi = await tokenFactory.deploy('iZi', 'iZi', 18);

        const veiZiFactory = await ethers.getContractFactory('TestVeiZi');
        veiZi = await veiZiFactory.deploy();

        iZi.connect(tester).approve(veiZi.address, hugeAmount);
        iZi.mint(tester.address, hugeAmount);
        

        const weth = await weth9.deployWETH9(signer);
        const wethAddr = weth.address;

        const deployed = await uniV3.deployUniV3(wethAddr, signer);

        uniPositionManager = deployed.uniPositionManager;
        const uniFactory = deployed.uniFactory;
        
        const priceiZiByUSDCDecimal = 0.5;
        const priceiZiByUSDCSqrt = BigNumber(priceiZiByUSDCDecimal).times(10 ** 6).div(10 ** 18).sqrt();
        if (USDC.address.toLowerCase() < iZi.address.toLowerCase()) {
            token0Decimal = 6;
            token1Decimal = 18;
            token0Symbol = 'USDC';
            token1Symbol = 'iZi';
            const priceUSDCByiZiSqrt = BigNumber(1).div(priceiZiByUSDCSqrt);
            const priceUSDCByiZiSqrtX96 = priceUSDCByiZiSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(USDC.address, iZi.address, '3000', priceUSDCByiZiSqrtX96);
        } else {
            token0Decimal = 18;
            token1Decimal = 6;
            token0Symbol = 'iZi';
            token1Symbol = 'USDC';
            const priceiZiByUSDCSqrtX96 = priceiZiByUSDCSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(iZi.address, USDC.address, '3000', priceiZiByUSDCSqrtX96);
        }

        const poolAddr = await uniFactory.getPool(USDC.address, iZi.address, '3000');
        const pool = await uniV3.getPool(signer, poolAddr);
        await pool.increaseObservationCardinalityNext(50);

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
                token0: USDC.address,
                token1: iZi.address,
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
            veiZi.address,
            blockNumber, blockNumber + 10000,
            '40',
            receiver.address,
            13864,13864,
            BigNumber(10000).times(10 ** 18).toFixed(0)
        ];

        const MiningFactory = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoostVeiZi");
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

        const oraclePrice = await mining.getOraclePrice();
        const avgTick = oraclePrice.avgTick;

        await mining.connect(miner).deposit(decimal2Amount(15000, token0Decimal), decimal2Amount(15000, token1Decimal), avgTick);
        await mining.connect(tester).deposit(decimal2Amount(1000, token0Decimal), decimal2Amount(1000, token1Decimal), avgTick);
        await mining.connect(tester).deposit(decimal2Amount(500, token0Decimal), decimal2Amount(500, token1Decimal), avgTick);
    });

    it("check user status", async function() {
        const userStatus = await mining.userStatus(tester.address);
        const vLiquidity = userStatus.vLiquidity.toString();

        const tokenStatus1 = await getTokenStatus(mining, '1');
        const tokenStatus2 = await getTokenStatus(mining, '2');
        const tokenStatus3 = await getTokenStatus(mining, '3');

        const nft1 = await getPosition(uniPositionManager, '1');
        const nft2 = await getPosition(uniPositionManager, '2');
        const nft3 = await getPosition(uniPositionManager, '3');

        expect(tokenStatus1.uniLiquidity).to.equal(nft1.liquidity);
        expect(tokenStatus2.uniLiquidity).to.equal(nft2.liquidity);
        expect(tokenStatus3.uniLiquidity).to.equal(nft3.liquidity);

        expect(vLiquidity).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity));
        const validVLiquidity = userStatus.validVLiquidity.toString();
        expect(validVLiquidity).to.equal(stringDiv(stringMul(vLiquidity, '4'), '10')); // 1500 * 0.4
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        expect(totalVLiquidity).to.equal(stringAdd(stringAdd(tokenStatus1.vLiquidity, tokenStatus2.vLiquidity), tokenStatus3.vLiquidity));
    });
    
    it("check reward", async function () {
        
        const userStatus = await mining.userStatus(tester.address);
        const validVLiquidity = userStatus.validVLiquidity.toString();
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        
        const blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 3);
        const rewardMap = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);

        for (const key in rewardMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('3', stringMul(rewardPerBlock, validVLiquidity)), totalVLiquidity);
            checkStringNumberNearlyEqual(rewardMap[key], reward);
        }

    });

    it("check reward/reward after staking veizi", async function () {

        const tokenStatus2 = await getTokenStatus(mining, '2');
        const tokenStatus3 = await getTokenStatus(mining, '3');
        
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
        expect(vLiquidity1).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity));
        const expectValidVLiquidity1 = getValidVLiquidity(vLiquidity1, totalVLiquidity1, stakingInfo1.amount, totalValidVeiZi1);
        const validVLiquidity1 = userStatus1.validVLiquidity.toString();
        expect(validVLiquidity1).to.equal(expectValidVLiquidity1);

        // collect again
        blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 5);
        const rewardMap2 = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo2 = await getStakingInfo(veiZi, tester.address);

        // reward
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
        expect(vLiquidity1).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity));
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });

    it("check withdraw/reward after staking veizi", async function () {
        
        const userStatus0 = await mining.userStatus(tester.address);
        const vLiquidity0 = userStatus0.vLiquidity.toString();
        const validVLiquidity0 = userStatus0.validVLiquidity.toString();
        const totalVLiquidity0 = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi0 = (await mining.totalValidVeiZi()).toString();
        const MAXTIME = Number((await veiZi.MAXTIME()).toString());
        
        let blockNumber = await ethers.provider.getBlockNumber();
        await veiZi.connect(tester).stake('2', decimal2Amount(10000, 18), blockNumber + MAXTIME);

        await waitUntilJustBefore(blockNumber + 3);

        const tokenStatus3 = await getTokenStatus(mining, '3');
        const uniWithdrawTokenAmount = await getUniswapWithdrawTokenAmount(uniPositionManager, '3', tokenStatus3.uniLiquidity);
        const deltaMap1 = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        const expectDeltaMap1 = {'iZi': '0', 'BIT': '0', 'USDC': '0'};
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo1 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('3', stringMul(rewardPerBlock, validVLiquidity0)), totalVLiquidity0);
            expectDeltaMap1[key] = reward;
        }
        expectDeltaMap1[token0Symbol] = stringAdd(expectDeltaMap1[token0Symbol], uniWithdrawTokenAmount.amount0);
        expectDeltaMap1[token1Symbol] = stringAdd(expectDeltaMap1[token1Symbol], uniWithdrawTokenAmount.amount1);

        for (const key in deltaMap1) {
            console.log(key, ' ', expectDeltaMap1[key], ' ' , deltaMap1[key])
            checkStringNumberNearlyEqual(expectDeltaMap1[key], deltaMap1[key]);
        }

        // but userStatus changed
        const totalVLiquidity1 = stringMinus(totalVLiquidity0, tokenStatus3.vLiquidity);
        const userStatus1 = await mining.userStatus(tester.address);
        const validVeiZiData1 = updateTotalValidVeiZi(totalValidVeiZi0, '0', stakingInfo1.amount, userStatus1.vLiquidity.toString(), totalVLiquidity1);
        const expectTotalValidVeiZi1 = validVeiZiData1.totalValidVeiZi;

        const totalValidVeiZi1 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi1).to.equal(expectTotalValidVeiZi1);

        const expectValidVeiZi1 = validVeiZiData1.validVeiZi;
        expect(userStatus1.validVeiZi.toString()).to.equal(expectValidVeiZi1);

        const vLiquidity1 = userStatus1.vLiquidity.toString();
        expect(vLiquidity1).to.equal(stringMinus(vLiquidity0, tokenStatus3.vLiquidity)); // withdrawed 500
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
        expect(vLiquidity2).to.equal(vLiquidity1);
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });

   
    it("check reward/withdraw after staking veizi", async function () {
        
        const userStatus0 = await mining.userStatus(tester.address);
        const vLiquidity0 = userStatus0.vLiquidity.toString();
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
        expect(vLiquidity1).to.equal(vLiquidity0);
        const expectValidVLiquidity1 = getValidVLiquidity(vLiquidity1, totalVLiquidity1, stakingInfo1.amount, totalValidVeiZi1);
        const validVLiquidity1 = userStatus1.validVLiquidity.toString();
        expect(validVLiquidity1).to.equal(expectValidVLiquidity1);

        // collect again
        blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 5);
        
        const tokenStatus3 = await getTokenStatus(mining, '3');
        const uniWithdrawTokenAmount = await getUniswapWithdrawTokenAmount(uniPositionManager, '3', tokenStatus3.uniLiquidity, USDC.address, iZi.address);
        const deltaMap1 = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        const expectDeltaMap1 = {'iZi': '0', 'BIT': '0', 'USDC': '0'};
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo2 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('5', stringMul(rewardPerBlock, validVLiquidity1)), totalVLiquidity1);
            expectDeltaMap1[key] = reward;
        }
        expectDeltaMap1[token0Symbol] = stringAdd(expectDeltaMap1[token0Symbol], uniWithdrawTokenAmount.amount0);
        expectDeltaMap1[token1Symbol] = stringAdd(expectDeltaMap1[token1Symbol], uniWithdrawTokenAmount.amount1);

        for (const key in deltaMap1) {
            checkStringNumberNearlyEqual(expectDeltaMap1[key], deltaMap1[key]);
        }

        // userStatus changed again
        const totalVLiquidity2 = stringMinus(totalVLiquidity1, tokenStatus3.vLiquidity);
        const userStatus2 = await mining.userStatus(tester.address);
        const validVeiZiData2 = updateTotalValidVeiZi(totalValidVeiZi1, validVeiZiData1.validVeiZi, stakingInfo2.amount, userStatus2.vLiquidity.toString(), totalVLiquidity2);
        const expectTotalValidVeiZi2 = validVeiZiData2.totalValidVeiZi;

        const totalValidVeiZi2 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi2).to.equal(expectTotalValidVeiZi2);

        const expectValidVeiZi2 = validVeiZiData2.validVeiZi;
        expect(userStatus2.validVeiZi.toString()).to.equal(expectValidVeiZi2);

        const vLiquidity2 = userStatus2.vLiquidity.toString();
        expect(vLiquidity2).to.equal(stringMinus(vLiquidity1, tokenStatus3.vLiquidity));
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });


    it("check addLiquidity/reward after staking veizi", async function () {
        
        const userStatus0 = await mining.userStatus(tester.address);
        const vLiquidity0 = userStatus0.vLiquidity.toString();
        const validVLiquidity0 = userStatus0.validVLiquidity.toString();
        const totalVLiquidity0 = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi0 = (await mining.totalValidVeiZi()).toString();
        const MAXTIME = Number((await veiZi.MAXTIME()).toString());
        
        let blockNumber = await ethers.provider.getBlockNumber();
        await veiZi.connect(tester).stake('2', decimal2Amount(10000, 18), blockNumber + MAXTIME);

        await waitUntilJustBefore(blockNumber + 3);

        const deltaMap1 = await addLiquidityAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, decimal2Amount(2000, token0Decimal), decimal2Amount(2000, token1Decimal));
        const tokenStatus4 = await getTokenStatus(mining, '4');
        const expectDeltaMap1 = {'iZi': '0', 'BIT': '0', 'USDC': '0'};
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo1 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('3', stringMul(rewardPerBlock, validVLiquidity0)), totalVLiquidity0);
            expectDeltaMap1[key] = reward;
        }
        expectDeltaMap1[token0Symbol] = stringMinus(expectDeltaMap1[token0Symbol], tokenStatus4.amount0);
        expectDeltaMap1[token1Symbol] = stringMinus(expectDeltaMap1[token1Symbol], tokenStatus4.amount1);

        for (const key in deltaMap1) {
            checkStringNumberNearlyEqual(expectDeltaMap1[key], deltaMap1[key]);
        }

        // but userStatus changed
        const totalVLiquidity1 = stringAdd(totalVLiquidity0, tokenStatus4.vLiquidity);
        const userStatus1 = await mining.userStatus(tester.address);
        const validVeiZiData1 = updateTotalValidVeiZi(totalValidVeiZi0, '0', stakingInfo1.amount, userStatus1.vLiquidity.toString(), totalVLiquidity1);
        const expectTotalValidVeiZi1 = validVeiZiData1.totalValidVeiZi;

        const totalValidVeiZi1 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi1).to.equal(expectTotalValidVeiZi1);

        const expectValidVeiZi1 = validVeiZiData1.validVeiZi;
        expect(userStatus1.validVeiZi.toString()).to.equal(expectValidVeiZi1);

        const vLiquidity1 = userStatus1.vLiquidity.toString();
        expect(vLiquidity1).to.equal(stringAdd(vLiquidity0, tokenStatus4.vLiquidity)); // withdrawed 500
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
        expect(vLiquidity2).to.equal(vLiquidity1);
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });

    it("check reward/addLiquidity after staking veizi", async function () {
        
        const userStatus0 = await mining.userStatus(tester.address);
        const vLiquidity0 = userStatus0.vLiquidity.toString();
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
        expect(vLiquidity1).to.equal(vLiquidity0);
        const expectValidVLiquidity1 = getValidVLiquidity(vLiquidity1, totalVLiquidity1, stakingInfo1.amount, totalValidVeiZi1);
        const validVLiquidity1 = userStatus1.validVLiquidity.toString();
        expect(validVLiquidity1).to.equal(expectValidVLiquidity1);

        // addLiquidity
        blockNumber = await ethers.provider.getBlockNumber();
        await waitUntilJustBefore(blockNumber + 5);
        
        const deltaMap1 = await addLiquidityAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, decimal2Amount(2000, token0Decimal), decimal2Amount(2000, token1Decimal));
        const tokenStatus4 = await getTokenStatus(mining, '4');
        const expectDeltaMap2 = {'iZi': '0', 'BIT': '0', 'USDC': '0'};
        blockNumber = await ethers.provider.getBlockNumber();
        const stakingInfo2 = await getStakingInfo(veiZi, tester.address);

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('5', stringMul(rewardPerBlock, validVLiquidity1)), totalVLiquidity1);
            expectDeltaMap2[key] = reward;
        }
        expectDeltaMap2[token0Symbol] = stringMinus(expectDeltaMap2[token0Symbol], tokenStatus4.amount0);
        expectDeltaMap2[token1Symbol] = stringMinus(expectDeltaMap2[token1Symbol], tokenStatus4.amount1);

        for (const key in deltaMap1) {
            checkStringNumberNearlyEqual(expectDeltaMap2[key], deltaMap1[key]);
        }

        // userStatus changed again
        const totalVLiquidity2 = stringAdd(totalVLiquidity1, tokenStatus4.vLiquidity);
        const userStatus2 = await mining.userStatus(tester.address);
        const validVeiZiData2 = updateTotalValidVeiZi(totalValidVeiZi1, validVeiZiData1.validVeiZi, stakingInfo2.amount, userStatus2.vLiquidity.toString(), totalVLiquidity2);
        const expectTotalValidVeiZi2 = validVeiZiData2.totalValidVeiZi;

        const totalValidVeiZi2 = (await mining.totalValidVeiZi()).toString();
        expect(totalValidVeiZi2).to.equal(expectTotalValidVeiZi2);

        const expectValidVeiZi2 = validVeiZiData2.validVeiZi;
        expect(userStatus2.validVeiZi.toString()).to.equal(expectValidVeiZi2);

        const vLiquidity2 = userStatus2.vLiquidity.toString();
        expect(vLiquidity2).to.equal(stringAdd(vLiquidity1, tokenStatus4.vLiquidity));
        const expectValidVLiquidity2 = getValidVLiquidity(vLiquidity2, totalVLiquidity2, stakingInfo2.amount, totalValidVeiZi2);
        const validVLiquidity2 = userStatus2.validVLiquidity.toString();
        expect(validVLiquidity2).to.equal(expectValidVLiquidity2);
    });
});