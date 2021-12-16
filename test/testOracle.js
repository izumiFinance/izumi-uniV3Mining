
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const { ethers } = require("hardhat");;
var uniV3 = require("./uniswap/deployUniV3.js");

async function getToken() {

  // deploy token
  const tokenFactory = await ethers.getContractFactory("TestToken")
  tokenX = await tokenFactory.deploy('a', 'a', 18);
  await tokenX.deployed();
  tokenY = await tokenFactory.deploy('b', 'b', 18);
  await tokenY.deployed();

  txAddr = tokenX.address.toLowerCase();
  tyAddr = tokenY.address.toLowerCase();

  if (txAddr > tyAddr) {
    tmpAddr = tyAddr;
    tyAddr = txAddr;
    txAddr = tmpAddr;

    tmpToken = tokenY;
    tokenY = tokenX;
    tokenX = tmpToken;
  }
  return [tokenX, tokenY];
}

function getFix96(a) {
    var b = BigNumber(a).times(BigNumber(2).pow(96));
    return b.toFixed(0);
}

function fix962Float(a) {
    let aa = BigNumber(a);
    let div = BigNumber(2).pow(96);
    return Number(aa.div(div).toFixed(10));
}

/*

        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // the most-recently updated index of the observations array
        uint16 observationIndex;
        // the current maximum number of observations that are being stored
        uint16 observationCardinality;
        */

async function getSlot0(pool) {
    var sqrtPriceX96, tick, observationIndex, observationCardinality;
    [sqrtPriceX96, tick, observationIndex, observationCardinality] = await pool.slot0();
    return {
        sqrtPriceX96, tick, observationIndex, observationCardinality
    };
}

async function getOracle(testOracle, poolAddr) {

    var tick, sqrtPriceX96, currTick, currSqrtPriceX96;
    [tick, sqrtPriceX96, currTick, currSqrtPriceX96] = await testOracle.getAvgTickPriceWithin2Hour(poolAddr);
    sqrtPriceX96 = sqrtPriceX96.toString();
    currSqrtPriceX96 = currSqrtPriceX96.toString();
    return {
        tick, sqrtPriceX96, currTick, currSqrtPriceX96
    };
}

/*

        // the block timestamp of the observation
        uint32 blockTimestamp;
        // the tick accumulator, i.e. tick * time elapsed since the pool was first initialized
        int56 tickCumulative;
        // the seconds per liquidity, i.e. seconds elapsed / max(1, liquidity) since the pool was first initialized
        uint160 secondsPerLiquidityCumulativeX128;
        // whether or not the observation is initialized
        bool initialized;
        */
async function getObservation(pool, idx) {
    var blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized;
    [blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized] = await pool.observations(idx);
    blockTimestamp = blockTimestamp.toString();
    tickCumulative = tickCumulative.toString();
    return {
        blockTimestamp, tickCumulative, secondsPerLiquidityCumulativeX128, initialized
    };
}

function getAvgTick(obs0, obs1) {
    var blockDelta = BigNumber(obs1.blockTimestamp).minus(obs0.blockTimestamp);
    var tickDelta = BigNumber(obs1.tickCumulative).minus(obs0.tickCumulative);
    return Number(tickDelta.div(blockDelta).toFixed(0, 3));
}

async function movePriceDown(uniSwapRouter, trader, tokenX, tokenY, price) {

    await uniSwapRouter.connect(trader).exactInputSingle({
        tokenIn: tokenX.address,
        tokenOut: tokenY.address,
        fee: 3000,
        recipient: trader.address,
        deadline: '0xffffffff',
        amountIn: '1000000000000000000000000000',
        amountOutMinimum: '1',
        sqrtPriceLimitX96: getFix96(price),
    });

}

async function movePriceUp(uniSwapRouter, trader, tokenX, tokenY, price) {

    await uniSwapRouter.connect(trader).exactInputSingle({
        tokenIn: tokenY.address,
        tokenOut: tokenX.address,
        fee: 3000,
        recipient: trader.address,
        deadline: '0xffffffff',
        amountIn: '1000000000000000000000000000',
        amountOutMinimum: '1',
        sqrtPriceLimitX96: getFix96(price),
    });

}

describe("test uniswap price oracle", function () {
    var signer, miner1, miner2, trader, tokenAProvider, tokenBProvider, recipient1, recipient2;

    var weth;
    var wethAddr;

    var uniFactory;
    var uniSwapRouter;
    var uniPositionManager;

    var tokenX;
    var tokenY;

    var rewardInfoA = {
      rewardtoken: undefined,
      provider: undefined,
      rewardPerBlock: undefined,
      accRewardPerShare: undefined,
    };
    var rewardInfoB = {
      token: undefined,
      provider: undefined,
      rewardPerBlock: undefined,
      accRewardPerShare: undefined,
    };

    var rewardLowerTick;
    var rewardUpperTick;

    var startBlock;
    var endBlock;

    var poolXYAddr;
    var pool;
    var sqrtPriceX_96;

    var mining2RewardNoBoost;

    var q96;

    var testOracle;
    
    beforeEach(async function() {
      
        [signer, miner, trader] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        weth = await tokenFactory.deploy('weth', 'weth', 18);
        wethAddr = weth.address;

        var deployed = await uniV3.deployUniV3(wethAddr, signer);
        uniFactory = deployed.uniFactory;
        uniSwapRouter = deployed.uniSwapRouter;
        uniPositionManager = deployed.uniPositionManager;

        [tokenX, tokenY] = await getToken();
        sqrtPriceX_96 = "0x2000000000000000000000000";
        await uniPositionManager.createAndInitializePoolIfNecessary(tokenX.address, tokenY.address, "3000", sqrtPriceX_96);
        
        await tokenX.mint(miner.address, "100000000000000000000000");
        await tokenY.mint(miner.address, "100000000000000000000000");

        await tokenX.connect(miner).approve(uniPositionManager.address, "100000000000000000000000");
        await tokenY.connect(miner).approve(uniPositionManager.address, "100000000000000000000000");

        await uniPositionManager.connect(miner).mint({
            token0: tokenX.address,
            token1: tokenY.address,
            fee: '3000',
            deadline: '0xffffffff',
            recipient: miner.address,
            amount0Desired: '100000000000000000000000',
            amount1Desired: '100000000000000000000000',
            amount0Min: 0,
            amount1Min: 0,
            tickLower: -30000,
            tickUpper: 30000,
        });

        await tokenX.mint(trader.address, "1000000000000000000000000000");
        await tokenY.mint(trader.address, "1000000000000000000000000000");

        await tokenX.connect(trader).approve(uniSwapRouter.address, "1000000000000000000000000000");
        await tokenY.connect(trader).approve(uniSwapRouter.address, "1000000000000000000000000000");

        const TestOracle = await ethers.getContractFactory('TestOracle');
        testOracle = await TestOracle.deploy();
        await testOracle.deployed();

        q96 = BigNumber(2).pow(96);

        poolXYAddr = await uniFactory.getPool(tokenX.address, tokenY.address, 3000);
        pool = await uniV3.getPool(signer, poolXYAddr);
    });
    
    it("no swap", async function () {
        var tick, sqrtPriceX96, currTick, currSqrtPriceX96;
        [tick, sqrtPriceX96, currTick, currSqrtPriceX96] = await testOracle.getAvgTickPriceWithin2Hour(poolXYAddr);
        expect(tick).to.equal(13863);
        expect(currTick).to.equal(13863);
    });

    it("after swaps but cardinality is only 1", async function() {
        
        await uniSwapRouter.connect(trader).exactInputSingle({
            tokenIn: tokenX.address,
            tokenOut: tokenY.address,
            fee: 3000,
            recipient: trader.address,
            deadline: '0xffffffff',
            amountIn: '1000000000000000000000000000',
            amountOutMinimum: '1',
            sqrtPriceLimitX96: getFix96('0.8'),
        });

        var s0 = await getSlot0(pool);
        var oracle = await getOracle(testOracle, poolXYAddr);

        expect(oracle.tick).to.equal(s0.tick);
        expect(oracle.sqrtPriceX96).to.equal(s0.sqrtPriceX96);
        // console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        // console.log('current price: ', fix962Float)

        console.log(s0.tick);
        console.log(oracle.tick);
        console.log(s0.observationCardinality);

    });


    it("num of observations does not reach cardinality, oldest within 2h", async function() {

        await pool.increaseObservationCardinalityNext(8);

        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.8); // 2 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 3 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 4 obs
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 5 obs
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.6); // 6 obs

        await pool.increaseObservationCardinalityNext(12);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(5);
        expect(s0.observationCardinality).to.equal(8);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs0 = await getObservation(pool, 0);
        var obs5 = await getObservation(pool, 5);

        var avgTick = getAvgTick(obs0, obs5);

        console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        console.log('expect price: ', BigNumber(1.0001).pow(avgTick).sqrt().toFixed(10));

        console.log(s0.tick);
        console.log('oracle tick: ', oracle.tick);
        console.log('avg tick: ', avgTick);
        console.log(s0.observationCardinality);

        expect(Number(oracle.tick)).to.equal(Number(avgTick));

    }); 
    it("num of observations reach cardinality, oldest within 2h", async function() {

        await pool.increaseObservationCardinalityNext(8);

        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.8); // 2 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 3 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 4 obs
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 5 obs
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.6); // 6 obs
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.9); // 7 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.7);  // 8 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5);  // 9 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.3);  // 10 obs
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.2);  // 11 obs


        await pool.increaseObservationCardinalityNext(12);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(2);
        expect(s0.observationCardinality).to.equal(8);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs2 = await getObservation(pool, 2);
        var obs3 = await getObservation(pool, 3);
        expect(obs3.initialized).to.equal(true);
        expect(obs2.initialized).to.equal(true);

        var avgTick = getAvgTick(obs2, obs3);

        console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        console.log('expect price: ', BigNumber(1.0001).pow(avgTick).sqrt().toFixed(10));

        console.log(s0.tick);
        console.log('oracle tick: ', oracle.tick);
        console.log('avg tick: ', avgTick);
        console.log(s0.observationCardinality);

        expect(Number(oracle.tick)).to.equal(Number(avgTick));

    }); 
    it("num of observations does not reach cardinality, oldest before 2h aglo", async function() {

        await pool.increaseObservationCardinalityNext(10);

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 2.1); // 2 obs, idx=1
        await ethers.provider.send('evm_increaseTime', [400]); 
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.9); // 3 obs, idx=2
        await ethers.provider.send('evm_increaseTime', [7000]); 
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 4 obs, idx=3
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 5 obs, idx=4
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 6 obs, idx=5

        await pool.increaseObservationCardinalityNext(20);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(5);
        expect(s0.observationCardinality).to.equal(10);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs5 = await getObservation(pool, 5);
        var obs1 = await getObservation(pool, 1);
        var obs2 = await getObservation(pool, 2);
        expect(obs5.initialized).to.equal(true);
        expect(obs2.initialized).to.equal(true);

        var avgTick1 = getAvgTick(obs1, obs5);
        var avgTick2 = getAvgTick(obs2, obs5);

        console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        var oracleSqrtPrice = fix962Float(oracle.sqrtPriceX96);
        var sqrtPrice1 = Number(BigNumber(1.0001).pow(avgTick1).sqrt().toFixed(10));
        var sqrtPrice2 = Number(BigNumber(1.0001).pow(avgTick2).sqrt().toFixed(10));
        
        expect(oracleSqrtPrice).to.lessThanOrEqual(Math.max(sqrtPrice1, sqrtPrice2));
        expect(oracleSqrtPrice).to.greaterThanOrEqual(Math.min(sqrtPrice1, sqrtPrice2));

        console.log('oracle tick: ', oracle.tick);
        console.log('avg tick1: ', avgTick1);
        console.log('avg tick2: ', avgTick2);

        expect(oracle.tick).to.lessThanOrEqual(Math.max(avgTick1, avgTick2));
        expect(oracle.tick).to.greaterThanOrEqual(Math.min(avgTick1, avgTick2));

    }); 
    it("num of observations reach cardinality, oldest before 2h ago, but [oldest, latest] within 1h", async function() {

        await pool.increaseObservationCardinalityNext(10);

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 2.1); // 2 obs, idx=1
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.9); // 3 obs, idx=2
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 4 obs, idx=3
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 5 obs, idx=4

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 6 obs, idx=5
        await ethers.provider.send('evm_increaseTime', [3000]); 
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 7 obs, idx=6
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.3);  // 8 obs, idx=7
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.1);  // 9 obs, idx=8
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 0.9);  // 10 obs, idx=9

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 10 obs, idx=0
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 10 obs, idx=1
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.6); // 10 obs, idx=2
        await ethers.provider.send('evm_increaseTime', [3500]); 

        await pool.increaseObservationCardinalityNext(20);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(2);
        expect(s0.observationCardinality).to.equal(10);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs2 = await getObservation(pool, 2); // latest
        var obs3 = await getObservation(pool, 3); // oldest

        expect(obs2.initialized).to.equal(true);
        expect(obs3.initialized).to.equal(true);

        var avgTick = getAvgTick(obs3, obs2);

        console.log('avg tick 6: ', avgTick);
        console.log('oracle tick: ', oracle.tick);

        expect(oracle.tick).to.equal(avgTick);

    }); 
    it("num of observations reach cardinality, oldest before 2h ago, [oldest, latest] more than 1h, latest within 1h", async function() {

        await pool.increaseObservationCardinalityNext(10);

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 2.1); // 2 obs, idx=1
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.9); // 3 obs, idx=2
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 4 obs, idx=3
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 5 obs, idx=4

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 6 obs, idx=5
        await ethers.provider.send('evm_increaseTime', [400]); 
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 7 obs, idx=6
        await ethers.provider.send('evm_increaseTime', [5000]); 
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.3);  // 8 obs, idx=7
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.1);  // 9 obs, idx=8
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 0.9);  // 10 obs, idx=9

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 10 obs, idx=0
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 10 obs, idx=1
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.6); // 10 obs, idx=2
        await ethers.provider.send('evm_increaseTime', [2000]); 

        await pool.increaseObservationCardinalityNext(20);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(2);
        expect(s0.observationCardinality).to.equal(10);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs2 = await getObservation(pool, 2);
        var obs5 = await getObservation(pool, 5);
        var obs6 = await getObservation(pool, 6);

        expect(obs2.initialized).to.equal(true);
        expect(obs5.initialized).to.equal(true);
        expect(obs6.initialized).to.equal(true);

        var avgTick5 = getAvgTick(obs5, obs2);
        var avgTick6 = getAvgTick(obs6, obs2);

        console.log('avg tick 5: ', avgTick5);
        console.log('avg tick 6: ', avgTick6);
        console.log('oracle tick: ', oracle.tick);

        console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        var oracleSqrtPrice = fix962Float(oracle.sqrtPriceX96);
        var sqrtPrice5 = Number(BigNumber(1.0001).pow(avgTick5).sqrt().toFixed(10));
        var sqrtPrice6 = Number(BigNumber(1.0001).pow(avgTick6).sqrt().toFixed(10));
        expect(oracleSqrtPrice).to.lessThanOrEqual(Math.max(sqrtPrice5, sqrtPrice6));
        expect(oracleSqrtPrice).to.greaterThanOrEqual(Math.min(sqrtPrice5, sqrtPrice6));

        expect(oracle.tick).to.lessThanOrEqual(Math.max(avgTick5, avgTick6));
        expect(oracle.tick).to.greaterThanOrEqual(Math.min(avgTick5, avgTick6));

    }); 
    it("num of observations reach cardinality, oldest before 2h ago, [oldest, latest] more than 1h, but latest is before 1h ago", async function() {

        await pool.increaseObservationCardinalityNext(10);

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 2.1); // 2 obs, idx=1
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.9); // 3 obs, idx=2
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 4 obs, idx=3
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1);  // 5 obs, idx=4

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 6 obs, idx=5
        await ethers.provider.send('evm_increaseTime', [700]); 
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 7 obs, idx=6
        await ethers.provider.send('evm_increaseTime', [3000]); 
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.3);  // 8 obs, idx=7
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 1.1);  // 9 obs, idx=8
        await movePriceDown(uniSwapRouter, trader, tokenX, tokenY, 0.9);  // 10 obs, idx=9

        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.2); // 10 obs, idx=0
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.5); // 10 obs, idx=1
        await movePriceUp(uniSwapRouter, trader, tokenX, tokenY, 1.6); // 10 obs, idx=2
        await ethers.provider.send('evm_increaseTime', [3700]); 

        await pool.increaseObservationCardinalityNext(20);

        var s0 = await getSlot0(pool);
        expect(s0.observationIndex).to.equal(2);
        expect(s0.observationCardinality).to.equal(10);
        var oracle = await getOracle(testOracle, poolXYAddr);

        var obs2 = await getObservation(pool, 2);
        var obs5 = await getObservation(pool, 5);
        var obs6 = await getObservation(pool, 6);

        expect(obs2.initialized).to.equal(true);
        expect(obs5.initialized).to.equal(true);
        expect(obs6.initialized).to.equal(true);

        var avgTick5 = getAvgTick(obs5, obs2);
        var avgTick6 = getAvgTick(obs6, obs2);

        console.log('avg tick 5: ', avgTick5);
        console.log('avg tick 6: ', avgTick6);
        console.log('oracle tick: ', oracle.tick);

        console.log('oracle price: ', fix962Float(oracle.sqrtPriceX96));
        var oracleSqrtPrice = fix962Float(oracle.sqrtPriceX96);
        var sqrtPrice5 = Number(BigNumber(1.0001).pow(avgTick5).sqrt().toFixed(10));
        var sqrtPrice6 = Number(BigNumber(1.0001).pow(avgTick6).sqrt().toFixed(10));
        expect(oracleSqrtPrice).to.lessThanOrEqual(Math.max(sqrtPrice5, sqrtPrice6));
        expect(oracleSqrtPrice).to.greaterThanOrEqual(Math.min(sqrtPrice5, sqrtPrice6));

        expect(oracle.tick).to.lessThanOrEqual(Math.max(avgTick5, avgTick6));
        expect(oracle.tick).to.greaterThanOrEqual(Math.min(avgTick5, avgTick6));

    }); 
});