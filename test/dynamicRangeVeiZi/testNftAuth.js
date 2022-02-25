
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

async function getCollectReward(tokenMap, mining, tester) {
    const beforeBalance = await getTokenBalance(tokenMap, tester);
    let ok = true;
    try {
        const tx = await mining.connect(tester).collectAllTokens();
    } catch (error) {
        ok = false;
    }
    const afterBalance = await getTokenBalance(tokenMap, tester);
    const reward = {};
    for (const key in tokenMap) {
        reward[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return {reward, ok};
}

async function withdrawAndComputeBalanceDiff(tokenMap, mining, tester, nftId) {
    const beforeBalance = await getTokenBalance(tokenMap, tester);
    let ok = true;
    try {
        const tx = await mining.connect(tester).withdraw(nftId, false);
    } catch (error) {
        ok = false;
    }
    const afterBalance = await getTokenBalance(tokenMap, tester);
    const delta = {};
    for (const key in tokenMap) {
        delta[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return {delta, ok};
}

async function emergencyWithdrawAndComputeBalanceDiff(tokenMap, mining, deployer, nftId) {
    const nftOwner = await mining.owners(nftId);
    const beforeBalance = await getTokenBalance(tokenMap, {address: nftOwner});
    const tx = await mining.connect(deployer).emergenceWithdraw(nftId);
    const afterBalance = await getTokenBalance(tokenMap, {address: nftOwner});
    const delta = {};
    for (const key in tokenMap) {
        delta[key] = stringMinus(afterBalance[key], beforeBalance[key]);
    }
    return delta;
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
        vLiquidity: tokenStatus.vLiquidity.toString(),
        amount0: tokenStatus.amount0.toString(),
        amount1: tokenStatus.amount1.toString()
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
    var token0Decimal, token1Decimal;
    var token0Symbol, token1Symbol;

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
            startPriceSqrtX96 = priceUSDCByiZiSqrtX96;
            endPriceSqrtX96 = stringMul(startPriceSqrtX96, '2');
            await uniPositionManager.createAndInitializePoolIfNecessary(USDC.address, iZi.address, '3000', priceUSDCByiZiSqrtX96);
        } else {
            token0Decimal = 18;
            token1Decimal = 6;
            token0Symbol = 'iZi';
            token1Symbol = 'USDC';
            const priceiZiByUSDCSqrtX96 = priceiZiByUSDCSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            startPriceSqrtX96 = priceiZiByUSDCSqrtX96;
            endPriceSqrtX96 = stringDiv(startPriceSqrtX96, '2');
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

        await mining.connect(miner).deposit(decimal2Amount(15000, token0Decimal), decimal2Amount(15000, token1Decimal), avgTick);

        await veiZi.connect(tester).stake('2', decimal2Amount(20000, 18), blockNumber + MAXTIME);
        await mining.connect(tester).deposit(decimal2Amount(15000, token0Decimal), decimal2Amount(15000, token1Decimal), avgTick);
        await mining.connect(tester).deposit(decimal2Amount(5000, token0Decimal), decimal2Amount(5000, token1Decimal), avgTick);
    });

    
    it("check withdraw after withdraw", async function () {
        
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

        const {delta: deltaMap1, ok: ok1} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        blockNumber = await ethers.provider.getBlockNumber();

        for (const key in rewardPerBlockMap) {
            expect(deltaMap1[key] !== '0').to.equal(true);
        }
        expect(ok1).to.equal(true);

        const userStatus = await mining.userStatus(tester.address);
        expect(userStatus.vLiquidity.toString()).to.equal(tokenStatus2.vLiquidity); // unchanged
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi = (await mining.totalValidVeiZi()).toString();
        
        const {delta: deltaMap2, ok: ok2} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        for (const key in rewardPerBlockMap) {
            expect(deltaMap2[key]).to.equal('0');
        }
        expect(ok2).to.equal(false);

        // meta data unchanged after failed withdraw
        expect(totalVLiquidity).to.equal((await mining.totalVLiquidity()).toString());
        expect(totalValidVeiZi).to.equal((await mining.totalValidVeiZi()).toString());
        const newUserStatus = await mining.userStatus(tester.address);
        expect(userStatus.validVeiZi.toString()).to.equal(newUserStatus.validVeiZi.toString());
        expect(userStatus.veiZi.toString()).to.equal(newUserStatus.veiZi.toString());
        expect(userStatus.vLiquidity.toString()).to.equal(newUserStatus.vLiquidity.toString());

    });


    it("check withdraw/collec/deposit after emergencyWithdraw", async function () {
        
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
        const tokenStatus3 = await getTokenStatus(mining, '3');

        const userStatus = await mining.userStatus(tester.address);
        expect(userStatus.vLiquidity.toString()).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity)); // unchanged
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi = (await mining.totalValidVeiZi()).toString();

        expect((await mining.normal())).to.equal(true);

        const lockRefund = await emergencyWithdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, signer, '3');
        expect((await mining.normal())).to.equal(false);
        expect(lockRefund['iZi']).to.equal('0');
        expect(lockRefund['USDC']).to.equal('0');
        expect(lockRefund['BIT']).to.equal('0');
        expect((await uniPositionManager.ownerOf('3')).toLowerCase()).to.equal(tester.address.toLowerCase());

        
        const {delta: deltaMap2, ok: ok2} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        for (const key in rewardPerBlockMap) {
            expect(deltaMap2[key]).to.equal('0');
        }
        expect(ok2).to.equal(false);

        // meta data unchanged after failed withdraw
        expect(totalVLiquidity).to.equal((await mining.totalVLiquidity()).toString());
        expect(totalValidVeiZi).to.equal((await mining.totalValidVeiZi()).toString());
        const newUserStatus = await mining.userStatus(tester.address);
        expect(userStatus.validVeiZi.toString()).to.equal(newUserStatus.validVeiZi.toString());
        expect(userStatus.veiZi.toString()).to.equal(newUserStatus.veiZi.toString());
        expect(userStatus.vLiquidity.toString()).to.equal(newUserStatus.vLiquidity.toString());

    });

    it("check withdraw by other", async function () {
        
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
        const tokenStatus3 = await getTokenStatus(mining, '3');

        const userStatus = await mining.userStatus(tester.address);
        expect(userStatus.vLiquidity.toString()).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity)); // unchanged
        const totalVLiquidity = (await mining.totalVLiquidity()).toString();
        const totalValidVeiZi = (await mining.totalValidVeiZi()).toString();

        const {delta: deltaMapSigner, ok: okSigner} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, signer, '3');
        for (const key in rewardPerBlockMap) {
            expect(deltaMapSigner[key]).to.equal('0');
        }
        expect(okSigner).to.equal(false);

        const {delta: deltaMapReceiver, ok: okReceiver} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, receiver, '3');
        for (const key in rewardPerBlockMap) {
            expect(deltaMapReceiver[key]).to.equal('0');
        }
        expect(okReceiver).to.equal(false);
        
        // meta data unchanged after failed withdraw
        expect(totalVLiquidity).to.equal((await mining.totalVLiquidity()).toString());
        expect(totalValidVeiZi).to.equal((await mining.totalValidVeiZi()).toString());
        const newUserStatus = await mining.userStatus(tester.address);
        expect(userStatus.validVeiZi.toString()).to.equal(newUserStatus.validVeiZi.toString());
        expect(userStatus.veiZi.toString()).to.equal(newUserStatus.veiZi.toString());
        expect(userStatus.vLiquidity.toString()).to.equal(stringAdd(tokenStatus2.vLiquidity, tokenStatus3.vLiquidity)); // unchanged

        const {delta: deltaMapTester, ok: okTester} = await withdrawAndComputeBalanceDiff({'iZi': iZi, 'BIT': BIT, 'USDC': USDC}, mining, tester, '3');
        for (const key in rewardPerBlockMap) {
            expect(deltaMapTester[key] !== '0').to.equal(true);
        }
        expect(okTester).to.equal(true);

        const lastUserStatus = await mining.userStatus(tester.address);
        expect(lastUserStatus.vLiquidity.toString()).to.equal(tokenStatus2.vLiquidity);
    });

});