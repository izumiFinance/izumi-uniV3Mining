
const { checkProperties } = require("@ethersproject/properties");
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const hardhat = require('hardhat');
const { ethers } = require("hardhat");;

var uniV3 = require("../uniswap/deployUniV3.js");
var weth9 = require('../uniswap/deployWETH9.js');
const NonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");

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

async function getUniswapCollectAmount(uniPositionManager, nftId) {
    const owner = await uniPositionManager.ownerOf(nftId);
    const managerWeb3 = new web3.eth.Contract(NonfungiblePositionManager.abi, uniPositionManager.address);
    const collectRet = await managerWeb3.methods.collect({
        tokenId: nftId,
        amount0Max: '0xffffffffffffffffffffffffffffffff',
        amount1Max: '0xffffffffffffffffffffffffffffffff',
        recipient: owner,
    }).call({from: owner});
    const amount0 = collectRet.amount0.toString();
    const amount1 = collectRet.amount1.toString();
    return {amount0, amount1};
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

async function collectFeeChargedAndComputeBalanceDiff(tokenMap, mining, receiver) {
    const beforeBalance = await getTokenBalance(tokenMap, receiver);
    try {
        const tx = await mining.connect(receiver).collectFeeCharged();
    } catch (err) {
        // ...
    }
    const afterBalance = await getTokenBalance(tokenMap, receiver);
    const delta = {};
    for (const key in tokenMap) {
        delta[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return delta;
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

async function movePriceDown(uniSwapRouter, trader, tokenXAddr, tokenYAddr, fee, destSqrtPriceX96, amountInputLimit) {
    await uniSwapRouter.connect(trader).exactInputSingle({
        tokenIn: tokenXAddr,
        tokenOut: tokenYAddr,
        fee: fee,
        recipient: trader.address,
        deadline: '0xffffffff',
        amountIn: amountInputLimit,
        amountOutMinimum: '0',
        sqrtPriceLimitX96: destSqrtPriceX96,
    });
}
  
async function movePriceUp(uniSwapRouter, trader, tokenXAddr, tokenYAddr, fee, destSqrtPriceX96, amountInputLimit) {
    await uniSwapRouter.connect(trader).exactInputSingle({
        tokenIn: tokenYAddr,
        tokenOut: tokenXAddr,
        fee: fee,
        recipient: trader.address,
        deadline: '0xffffffff',
        amountIn: amountInputLimit,
        amountOutMinimum: '1',
        sqrtPriceLimitX96: destSqrtPriceX96,
    });
}

async function sellTokenLock(uniSwapRouter, trader, tokenUniAddr, tokenLockAddr, fee, destSqrtPriceX96, amountInputLimit) {
    if (tokenUniAddr.toLowerCase() < tokenLockAddr.toLowerCase()) {
        // tokenLockAddr is tokenY
        // sell tokenLock is selling y and buying x
        // move price up
        await movePriceUp(uniSwapRouter, trader, tokenUniAddr, tokenLockAddr, fee, destSqrtPriceX96, amountInputLimit);
    } else {
        await movePriceDown(uniSwapRouter, trader, tokenLockAddr, tokenUniAddr, fee, destSqrtPriceX96, amountInputLimit);
    }
}

async function buyTokenLock(uniSwapRouter, trader, tokenUniAddr, tokenLockAddr, fee, destSqrtPriceX96, amountInputLimit) {
    if (tokenUniAddr.toLowerCase() < tokenLockAddr.toLowerCase()) {
        // tokenLockAddr is tokenY
        // sell tokenLock is selling y and buying x
        // move price up
        await movePriceDown(uniSwapRouter, trader, tokenUniAddr, tokenLockAddr, fee, destSqrtPriceX96, amountInputLimit);
    } else {
        await movePriceUp(uniSwapRouter, trader, tokenLockAddr, tokenUniAddr, fee, destSqrtPriceX96, amountInputLimit);
    }
}

async function getTokenStatus(mining, nftId) {
    const tokenStatus = await mining.tokenStatus(nftId);
    return {
        nftId: nftId,
        vLiquidity: tokenStatus.vLiquidity.toString(),
        lastTokensOwed0: tokenStatus.lastTokensOwed0.toString(),
        lastTokensOwed1: tokenStatus.lastTokensOwed1.toString()
    };
}

describe("test uniswap price oracle", function () {

    var signer, tester, receiver, provider;
    var iZi;
    var veiZi;
    var mining;
    var BIT;
    var token0, token1;
    var hugeAmount;
    var iZiRewardPerBlock, BITRewardPerBlock;
    var rewardPerBlockMap;
    var uniPositionManager;

    var leftSqrtPriceX96;
    var rightSqrtPriceX96;

    beforeEach(async function() {

        hugeAmount = '1000000000000000000000000000000';
      
        [signer, tester, miner, receiver, provider, trader] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        token0 = await tokenFactory.deploy('USDC', 'USDC', 6);
        token1 = await tokenFactory.deploy('USDT', 'USDT', 6);
        if (token0.address.toLowerCase() > token1.address.toLowerCase()) {
            const tmp = token0;
            token0 = token1;
            token1 = tmp;
        }

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
        uniSwapRouter = deployed.uniSwapRouter;

        const uniFactory = deployed.uniFactory;
        await uniFactory.enableFeeAmount(100, 1);
        await uniPositionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, '100', BigNumber(2).pow(96).toFixed(0));

        const poolAddr = await uniFactory.getPool(token0.address, token1.address, '100');
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
                token0: token0.address,
                token1: token1.address,
                fee: '100'
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
            10, -10,
            blockNumber, blockNumber + 10000,
            '40',
            receiver.address,
            BigNumber(10000).times(10 ** 18).toFixed(0)
        ];

        const MiningFactory = await hardhat.ethers.getContractFactory("MiningFixRangeBoostVeiZi");
        mining = await MiningFactory.deploy(...args);
        await BIT.mint(provider.address, hugeAmount);
        await iZi.mint(provider.address, hugeAmount);
        await BIT.connect(provider).approve(mining.address, hugeAmount);
        await iZi.connect(provider).approve(mining.address, hugeAmount);

        await token0.mint(tester.address, hugeAmount);
        await token0.connect(tester).approve(mining.address, hugeAmount);
        await token0.connect(tester).approve(uniPositionManager.address, hugeAmount);
        await token1.mint(tester.address, hugeAmount);
        await token1.connect(tester).approve(mining.address, hugeAmount);
        await token1.connect(tester).approve(uniPositionManager.address, hugeAmount);

        // a big miner
        await token0.mint(miner.address, hugeAmount);
        await token0.connect(miner).approve(mining.address, hugeAmount);
        await token0.connect(miner).approve(uniPositionManager.address, hugeAmount);
        await token1.mint(miner.address, hugeAmount);
        await token1.connect(miner).approve(mining.address, hugeAmount);
        await token1.connect(miner).approve(uniPositionManager.address, hugeAmount);

        await token0.mint(trader.address, hugeAmount);
        await token0.connect(trader).approve(uniSwapRouter.address, hugeAmount);
        await token1.mint(trader.address, hugeAmount);
        await token1.connect(trader).approve(uniSwapRouter.address, hugeAmount);

        // miner mint veiZi
        blockNumber = await ethers.provider.getBlockNumber();
        const MAXTIME = await veiZi.MAXTIME();
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);

        await uniPositionManager.connect(miner).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -8,
            tickUpper: 20,
            amount0Desired: decimal2Amount(30000, 6),
            amount1Desired: decimal2Amount(30000, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: miner.address,
            deadline: '0xffffffff',
        });
        await uniPositionManager.connect(tester).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -20,
            tickUpper: 5,
            amount0Desired: decimal2Amount(20000, 6),
            amount1Desired: decimal2Amount(20000, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: tester.address,
            deadline: '0xffffffff',
        });
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);
        await veiZi.connect(tester).stake('2', decimal2Amount(20000, 18), blockNumber + MAXTIME);

        await uniPositionManager.connect(miner).setApprovalForAll(mining.address, true);
        await uniPositionManager.connect(tester).setApprovalForAll(mining.address, true);

        await uniPositionManager.connect(tester).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -9,
            tickUpper: 9,
            amount0Desired: decimal2Amount(600, 6),
            amount1Desired: decimal2Amount(600, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: tester.address,
            deadline: '0xffffffff',
        });

        await mining.connect(miner).deposit('1');
        await mining.connect(tester).deposit('2');

        leftSqrtPriceX96 = BigNumber('1.0001').pow(-10).times(BigNumber('2').pow(96)).toFixed(0);
        rightSqrtPriceX96 = BigNumber('1.0001').pow(10).times(BigNumber('2').pow(96)).toFixed(0);

    });

    
    it("check reward", async function () {
        
        const userStatus = await mining.userStatus(tester.address);
        const validVLiquidity = userStatus.validVLiquidity.toString();
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        
        let blockNumber = await ethers.provider.getBlockNumber();
        // swaps

        await movePriceDown(uniSwapRouter, trader, token0.address, token1.address, '100', leftSqrtPriceX96, decimal2Amount(100000, 6));
        await movePriceUp(uniSwapRouter, trader, token0.address, token1.address, '100', rightSqrtPriceX96, decimal2Amount(100000, 6));
        await movePriceDown(uniSwapRouter, trader, token0.address, token1.address, '100', leftSqrtPriceX96, decimal2Amount(100000, 6));
        await movePriceUp(uniSwapRouter, trader, token0.address, token1.address, '100', rightSqrtPriceX96, decimal2Amount(100000, 6));
        await movePriceDown(uniSwapRouter, trader, token0.address, token1.address, '100', leftSqrtPriceX96, decimal2Amount(100000, 6));
        await movePriceUp(uniSwapRouter, trader, token0.address, token1.address, '100', rightSqrtPriceX96, decimal2Amount(100000, 6));

        await waitUntilJustBefore(blockNumber + 20);

        const tokenStatus2 = await getTokenStatus(mining, '2');
        const uniCollectTokenAmount = await getUniswapCollectAmount(uniPositionManager, '2');

        const expectToken0Remain = stringDiv(stringMul(uniCollectTokenAmount.amount0, 6), 10);
        const expectToken0Charged = stringMinus(uniCollectTokenAmount.amount0, expectToken0Remain);
        const expectToken1Remain = stringDiv(stringMul(uniCollectTokenAmount.amount1, 6), 10);
        const expectToken1Charged = stringMinus(uniCollectTokenAmount.amount1, expectToken1Remain);

        const deltaMap1 = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'TOKEN0': token0, 'TOKEN1': token1}, mining, tester, '2');
        const expectDeltaMap1 = {'iZi': '0', 'BIT': '0', 'TOKEN0': '0', 'TOKEN1': '0'};
        blockNumber = await ethers.provider.getBlockNumber();

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('20', stringMul(rewardPerBlock, validVLiquidity)), totalVLiquidity);
            expectDeltaMap1[key] = reward;
        }

        expectDeltaMap1['TOKEN0'] = stringAdd(expectDeltaMap1['TOKEN0'], expectToken0Remain);
        expectDeltaMap1['TOKEN1'] = stringAdd(expectDeltaMap1['TOKEN1'], expectToken1Remain);

        // check balance changes after withdraw
        for (const key in deltaMap1) {
            checkStringNumberNearlyEqual(expectDeltaMap1[key], deltaMap1[key]);
        }
        expect((await uniPositionManager.ownerOf('2')).toLowerCase()).to.equal(tester.address.toLowerCase());

        const totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
        const totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();

        expect(totalFeeCharged0).to.equal(expectToken0Charged);
        expect(totalFeeCharged1).to.equal(expectToken1Charged);

        // others cannot collect
        const signerDelta = await collectFeeChargedAndComputeBalanceDiff({'TOKEN0': token0, 'TOKEN1': token1}, mining, signer);
        expect(signerDelta['TOKEN0']).to.equal('0');
        expect(signerDelta['TOKEN1']).to.equal('0');
        expect((await mining.totalFeeCharged0()).toString()).to.equal(totalFeeCharged0);
        expect((await mining.totalFeeCharged1()).toString()).to.equal(totalFeeCharged1);

        const testerDelta = await collectFeeChargedAndComputeBalanceDiff({'TOKEN0': token0, 'TOKEN1': token1}, mining, tester);
        expect(testerDelta['TOKEN0']).to.equal('0');
        expect(testerDelta['TOKEN1']).to.equal('0');
        expect((await mining.totalFeeCharged0()).toString()).to.equal(totalFeeCharged0);
        expect((await mining.totalFeeCharged1()).toString()).to.equal(totalFeeCharged1);


        const receiverDelta = await collectFeeChargedAndComputeBalanceDiff({'TOKEN0': token0, 'TOKEN1': token1}, mining, receiver);
        expect(receiverDelta['TOKEN0']).to.equal(totalFeeCharged0);
        expect(receiverDelta['TOKEN1']).to.equal(totalFeeCharged1);
        expect((await mining.totalFeeCharged0()).toString()).to.equal('0');
        expect((await mining.totalFeeCharged1()).toString()).to.equal('0');
    });

});