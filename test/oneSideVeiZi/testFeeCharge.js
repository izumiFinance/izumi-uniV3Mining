
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

async function getUniswapCollectAmount(uniPositionManager, nftId, tokenUni, tokenLock) {
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
    if (tokenUni.toLowerCase() < tokenLock.toLowerCase()) {
        return {
            amountUni: amount0,
            amountLock: amount1,
        };
    } else {
        return {
            amountUni: amount1,
            amountLock: amount0,
        }
    }
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

async function getUniswapWithdrawTokenAmount(uniPositionManager, nftId, liquidity, tokenUni, tokenLock) {
    const owner = await uniPositionManager.ownerOf(nftId);
    const abi = NonfungiblePositionManager.abi;
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
    if (tokenUni.toLowerCase() < tokenLock.toLowerCase()) {
        return {
            amountUni: amount0,
            amountLock: amount1,
        };
    } else {
        return {
            amountUni: amount1,
            amountLock: amount0,
        }
    }
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
        nftId: tokenStatus.nftId.toString(),
        uniLiquidity: tokenStatus.uniLiquidity.toString(),
        lockAmount: tokenStatus.lockAmount.toString(),
        vLiquidity: tokenStatus.vLiquidity.toString()
    };
}

describe("test uniswap price oracle", function () {

    var signer, tester, receiver, provider, trader;
    var iZi;
    var USDC;
    var veiZi;
    var mining;
    var BIT;
    var hugeAmount;
    var iZiRewardPerBlock, BITRewardPerBlock;
    var rewardPerBlockMap;
    var uniPositionManager;
    var uniSwapRouter;

    var startPriceSqrtX96;
    var endPriceSqrtX96;

    beforeEach(async function() {

        hugeAmount = '1000000000000000000000000000000';
      
        [signer, tester, miner, receiver, provider, trader] = await ethers.getSigners();

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
        uniSwapRouter = deployed.uniSwapRouter;
        const priceiZiByUSDCDecimal = 0.5;
        const priceiZiByUSDCSqrt = BigNumber(priceiZiByUSDCDecimal).times(10 ** 6).div(10 ** 18).sqrt();
        if (USDC.address.toLowerCase() < iZi.address.toLowerCase()) {
            const priceUSDCByiZiSqrt = BigNumber(1).div(priceiZiByUSDCSqrt);
            const priceUSDCByiZiSqrtX96 = priceUSDCByiZiSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            startPriceSqrtX96 = priceUSDCByiZiSqrtX96;
            endPriceSqrtX96 = stringMul(startPriceSqrtX96, '2');
            await uniPositionManager.createAndInitializePoolIfNecessary(USDC.address, iZi.address, '3000', priceUSDCByiZiSqrtX96);
        } else {
            const priceiZiByUSDCSqrtX96 = priceiZiByUSDCSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            startPriceSqrtX96 = priceiZiByUSDCSqrtX96;
            endPriceSqrtX96 = stringDiv(startPriceSqrtX96, '2');
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

        // trader
        await USDC.mint(trader.address, hugeAmount);
        await USDC.connect(trader).approve(uniSwapRouter.address, hugeAmount);
        await iZi.mint(trader.address, hugeAmount);
        await iZi.connect(trader).approve(uniSwapRouter.address, hugeAmount);

        // miner mint veiZi
        blockNumber = await ethers.provider.getBlockNumber();
        const MAXTIME = await veiZi.MAXTIME();
        const oraclePrice = await mining.getOraclePrice();
        const avgTick = oraclePrice.avgTick;
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);

        await mining.connect(miner).depositWithuniToken(decimal2Amount(15000, 6), avgTick, '0xffffffff');

        await veiZi.connect(tester).stake('2', decimal2Amount(20000, 18), blockNumber + MAXTIME);
        await mining.connect(tester).depositWithuniToken(decimal2Amount(20000, 6), avgTick, '0xffffffff');
    });

    
    it("check reward", async function () {
        
        const userStatus = await mining.userStatus(tester.address);
        const validVLiquidity = userStatus.validVLiquidity.toString();
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        
        let blockNumber = await ethers.provider.getBlockNumber();
        // swaps
        await sellTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', endPriceSqrtX96, decimal2Amount(100000, 18));
        await buyTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', startPriceSqrtX96, decimal2Amount(100000, 6));
        await sellTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', endPriceSqrtX96, decimal2Amount(100000, 18));
        await buyTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', startPriceSqrtX96, decimal2Amount(100000, 6));
        await sellTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', endPriceSqrtX96, decimal2Amount(100000, 18));
        await buyTokenLock(uniSwapRouter, trader, USDC.address, iZi.address, '3000', startPriceSqrtX96, decimal2Amount(100000, 6));

        await waitUntilJustBefore(blockNumber + 20);

        const tokenStatus2 = await getTokenStatus(mining, '2');
        const uniWithdrawTokenAmount = await getUniswapWithdrawTokenAmount(uniPositionManager, '2', tokenStatus2.uniLiquidity, USDC.address, iZi.address);
        const uniCollectTokenAmount = await getUniswapCollectAmount(uniPositionManager, '2', USDC.address, iZi.address);

        const expectUniRemain = stringDiv(stringMul(uniCollectTokenAmount.amountUni, 6), 10);
        const expectUniCharged = stringMinus(uniCollectTokenAmount.amountUni, expectUniRemain);
        const expectLockRemain = stringDiv(stringMul(uniCollectTokenAmount.amountLock, 6), 10);
        const expectLockCharged = stringMinus(uniCollectTokenAmount.amountLock, expectLockRemain);

        const deltaMap1 = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '2');
        const expectDeltaMap1 = {'iZi': '0', 'BIT': '0', 'USDC': '0'};
        blockNumber = await ethers.provider.getBlockNumber();

        // reward is origin reward
        for (const key in rewardPerBlockMap) {
            const rewardPerBlock = rewardPerBlockMap[key];
            const reward = stringDiv(stringMul('20', stringMul(rewardPerBlock, validVLiquidity)), totalVLiquidity);
            expectDeltaMap1[key] = reward;
        }
        expectDeltaMap1['iZi'] = stringAdd(expectDeltaMap1['iZi'], tokenStatus2.lockAmount);
        expectDeltaMap1['iZi'] = stringAdd(expectDeltaMap1['iZi'], uniWithdrawTokenAmount.amountLock);
        expectDeltaMap1['USDC'] = stringAdd(expectDeltaMap1['USDC'], uniWithdrawTokenAmount.amountUni);

        expectDeltaMap1['iZi'] = stringAdd(expectDeltaMap1['iZi'], uniCollectTokenAmount.amountLock);
        expectDeltaMap1['USDC'] = stringAdd(expectDeltaMap1['USDC'], uniCollectTokenAmount.amountUni);

        // minus fee charged
        expectDeltaMap1['iZi'] = stringMinus(expectDeltaMap1['iZi'], expectLockCharged);
        expectDeltaMap1['USDC'] = stringMinus(expectDeltaMap1['USDC'], expectUniCharged);

        // check balance changes after withdraw
        for (const key in deltaMap1) {
            checkStringNumberNearlyEqual(expectDeltaMap1[key], deltaMap1[key]);
        }

        const totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
        const totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();

        const uniFeeCharged = (USDC.address.toLowerCase() < iZi.address.toLowerCase()) ? totalFeeCharged0: totalFeeCharged1;
        const lockFeeCharged = (iZi.address.toLowerCase() < USDC.address.toLowerCase()) ? totalFeeCharged0: totalFeeCharged1;

        expect(uniFeeCharged).to.equal(expectUniCharged);
        expect(lockFeeCharged).to.equal(expectLockCharged);

        // others cannot collect
        const signerDelta = await collectFeeChargedAndComputeBalanceDiff({'iZi': iZi, 'USDC': USDC}, mining, signer);
        expect(signerDelta['iZi']).to.equal('0');
        expect(signerDelta['USDC']).to.equal('0');
        expect((await mining.totalFeeCharged0()).toString()).to.equal(totalFeeCharged0);
        expect((await mining.totalFeeCharged1()).toString()).to.equal(totalFeeCharged1);

        const testerDelta = await collectFeeChargedAndComputeBalanceDiff({'iZi': iZi, 'USDC': USDC}, mining, tester);
        expect(testerDelta['iZi']).to.equal('0');
        expect(testerDelta['USDC']).to.equal('0');
        expect((await mining.totalFeeCharged0()).toString()).to.equal(totalFeeCharged0);
        expect((await mining.totalFeeCharged1()).toString()).to.equal(totalFeeCharged1);


        const receiverDelta = await collectFeeChargedAndComputeBalanceDiff({'iZi': iZi, 'USDC': USDC}, mining, receiver);
        expect(receiverDelta['iZi']).to.equal(lockFeeCharged);
        expect(receiverDelta['USDC']).to.equal(uniFeeCharged);
        expect((await mining.totalFeeCharged0()).toString()).to.equal('0');
        expect((await mining.totalFeeCharged1()).toString()).to.equal('0');
    });

});