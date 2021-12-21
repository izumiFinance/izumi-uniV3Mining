
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const { ethers } = require("hardhat");;
var uniV3 = require("./uniswap/deployUniV3.js");

async function deployToken(name, symbol, decimal) {
    var tokenFactory = await ethers.getContractFactory("TestToken");
    var token = await tokenFactory.deploy(name, symbol, decimal);
    return token;
  }
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

async function getTokenStatus(mining, nftId) {
    var nid, uniLiquidity, lockAmount, vLiquidity, validVLiquidity, nIZI, lastTouchBock;
    [nid, uniLiquidity, lockAmount, vLiquidity, validVLiquidity, nIZI, lastTouchBock] = await mining.tokenStatus(nftId);
    return {
      nftId: nid.toString(),
      uniLiquidity: uniLiquidity.toString(),
      lockAmount: lockAmount.toString(),
      vLiquidity: vLiquidity.toString(),
      validVLiquidity: validVLiquidity.toString(),
      nIZI: nIZI.toString(),
      lastTouchBock: lastTouchBock.toString(),
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

async function addUniswapPool(uniPositionManager, tokenX, tokenY, sqrtPriceX_96) {

    await uniPositionManager.createAndInitializePoolIfNecessary(tokenX.address, tokenY.address, "3000", sqrtPriceX_96);
    
}

async function deployMining(poolParams, rewardInfos) {
    const MiningFactory = await ethers.getContractFactory('MiningOneSideBoost');
    var mining = await MiningFactory.deploy(
        poolParams, rewardInfos, '1', '0x0000000000000000000000000000000000000000', 1, 1000000000000
    );
    await mining.deployed();
    return mining;
}
describe("test uniswap price oracle", function () {
    var signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2;

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

    
    beforeEach(async function() {
      
        [signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2] = await ethers.getSigners();

        console.log('aaa');
        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        weth = await tokenFactory.deploy('weth', 'weth', 18);
        wethAddr = weth.address;

        console.log('bbb');

        var deployed = await uniV3.deployUniV3(wethAddr, signer);
        uniFactory = deployed.uniFactory;
        uniSwapRouter = deployed.uniSwapRouter;
        uniPositionManager = deployed.uniPositionManager;

        console.log('ccc');

        [tokenX, tokenY] = await getToken();


        q96 = BigNumber(2).pow(96);

        qMax = '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';

    });
    
    it("price (Y/X) is 1, lock y", async function () {
        console.log('eee');
        var token0 = await deployToken("z0", "z0", 18);
        console.log('eeeeeee');
        await token0.transfer(provider0.address, "1000000000000000");

        console.log('fff');

        await addUniswapPool(uniPositionManager, tokenX, tokenY, "0x1000000000000000000000000");
        console.log('ggg');

        var rewardInfo0 = {
            rewardToken: undefined,
            rewardPerBlock: undefined,
            provider: undefined,
            accRewardPerShare: undefined,
        };

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        var tokenUni = tokenX;
        var tokenLock = tokenY;

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        }
        console.log('mining one side');
        miningOneSideBoost = await deployMining(
            poolParams, 
            [rewardInfo0]);
        console.log('aaaaa');
                
        var Q96Div3 = q96.div(3).minus(1).toFixed(0, 3);
        console.log('amount: ', Q96Div3);
        
        await tokenX.mint(miner1.address, Q96Div3);
        await tokenX.connect(miner1).approve(miningOneSideBoost.address, Q96Div3);

        await tokenY.mint(miner1.address, "10000000000000000000000000000000000000000");
        await tokenY.connect(miner1).approve(miningOneSideBoost.address, "10000000000000000000000000000000000000000");
        
        var uniAmount = Q96Div3;
        
        await miningOneSideBoost.connect(miner1).depositWithuniToken(uniAmount, "0", "0xffffffff");

        var ts = await getTokenStatus(miningOneSideBoost, "1");
        console.log(ts.lockAmount);
        
    });

    it("price (Y/X) is 2^2, lock y", async function () {
        console.log('eee');
        var token0 = await deployToken("z0", "z0", 18);
        console.log('eeeeeee');
        await token0.transfer(provider0.address, "1000000000000000");

        console.log('fff');

        await addUniswapPool(uniPositionManager, tokenX, tokenY, "0x2000000000000000000000000");
        console.log('ggg');

        var rewardInfo0 = {
            rewardToken: undefined,
            rewardPerBlock: undefined,
            provider: undefined,
            accRewardPerShare: undefined,
        };

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        var tokenUni = tokenX;
        var tokenLock = tokenY;

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        }
        console.log('mining one side');
        miningOneSideBoost = await deployMining(
            poolParams, 
            [rewardInfo0]);
        console.log('aaaaa');
                
        var Q96Div3 = q96.div(3).minus(1).toFixed(0, 3);
        console.log('amount: ', Q96Div3);
        
        await tokenX.mint(miner1.address, Q96Div3);
        await tokenX.connect(miner1).approve(miningOneSideBoost.address, Q96Div3);

        await tokenY.mint(miner1.address, "10000000000000000000000000000000000000000");
        await tokenY.connect(miner1).approve(miningOneSideBoost.address, "10000000000000000000000000000000000000000");
        
        var uniAmount = Q96Div3;
        
        await miningOneSideBoost.connect(miner1).depositWithuniToken(uniAmount, "0", "0xffffffff");

        var ts = await getTokenStatus(miningOneSideBoost, "1");
        console.log(ts.lockAmount);
        
    });

    it("price (Y/X) is 2^2, lock x", async function () {
        console.log('eee');
        var token0 = await deployToken("z0", "z0", 18);
        console.log('eeeeeee');
        await token0.transfer(provider0.address, "1000000000000000");

        console.log('fff');

        await addUniswapPool(uniPositionManager, tokenX, tokenY, "0x2000000000000000000000000");
        console.log('ggg');

        var rewardInfo0 = {
            rewardToken: undefined,
            rewardPerBlock: undefined,
            provider: undefined,
            accRewardPerShare: undefined,
        };

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        var tokenUni = tokenY;
        var tokenLock = tokenX;

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        }
        console.log('mining one side');
        miningOneSideBoost = await deployMining(
            poolParams, 
            [rewardInfo0]);
        console.log('aaaaa');
                
        var Q96Div3 = q96.div(3).minus(1).toFixed(0, 3);
        console.log('amount: ', Q96Div3);
        
        await tokenY.mint(miner1.address, Q96Div3);
        await tokenY.connect(miner1).approve(miningOneSideBoost.address, Q96Div3);

        await tokenX.mint(miner1.address, "10000000000000000000000000000000000000000");
        await tokenX.connect(miner1).approve(miningOneSideBoost.address, "10000000000000000000000000000000000000000");
        
        var uniAmount = Q96Div3;
        
        await miningOneSideBoost.connect(miner1).depositWithuniToken(uniAmount, "0", "0xffffffff");

        var ts = await getTokenStatus(miningOneSideBoost, "1");
        console.log(ts.lockAmount);
        console.log(ts.uniLiquidity);
        
    });


    it("price (Y/X) is near MIN_SQRT_RATIO(>1.0001 ^ 500000), lock x", async function () {
        console.log('eee');
        var token0 = await deployToken("z0", "z0", 18);
        console.log('eeeeeee');
        await token0.transfer(provider0.address, "1000000000000000");

        console.log('fff');

        await addUniswapPool(uniPositionManager, tokenX, tokenY, "100000000000000000000");
        console.log('ggg');

        var rewardInfo0 = {
            rewardToken: undefined,
            rewardPerBlock: undefined,
            provider: undefined,
            accRewardPerShare: undefined,
        };

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        var tokenUni = tokenY;
        var tokenLock = tokenX;

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        };
        console.log('mining one side');
        miningOneSideBoost = await deployMining(
            poolParams, 
            [rewardInfo0]);
        console.log('aaaaa');
                
        var uniAmount = q96.div(5700).minus(1).toFixed(0, 3);
        console.log('amount: ', uniAmount);
        
        await tokenY.mint(miner1.address, uniAmount);
        await tokenY.connect(miner1).approve(miningOneSideBoost.address, uniAmount);

        await tokenX.mint(miner1.address, qMax);
        await tokenX.connect(miner1).approve(miningOneSideBoost.address, qMax);
        
        
        await miningOneSideBoost.connect(miner1).depositWithuniToken(uniAmount, "0", "0xffffffff");

        var ts = await getTokenStatus(miningOneSideBoost, "1");
        console.log(ts.lockAmount);
        console.log(ts.lockAmount.length);
        
    });
    it("price (Y/X) is near MIN_SQRT_RATIO(>1.0001 ^ 500000), lock y", async function () {
        console.log('eee');
        var token0 = await deployToken("z0", "z0", 18);
        console.log('eeeeeee');
        await token0.transfer(provider0.address, "1000000000000000");

        console.log('fff');

        await addUniswapPool(uniPositionManager, tokenX, tokenY, "100000000000000000000");
        console.log('ggg');

        var rewardInfo0 = {
            rewardToken: undefined,
            rewardPerBlock: undefined,
            provider: undefined,
            accRewardPerShare: undefined,
        };

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        var tokenUni = tokenX;
        var tokenLock = tokenY;

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        };
        console.log('mining one side');
        miningOneSideBoost = await deployMining(
            poolParams, 
            [rewardInfo0]);
        console.log('aaaaa');
                
        var uniAmount = q96.div(3).minus(1).toFixed(0, 3);
        console.log('amount: ', uniAmount);
        
        await tokenX.mint(miner1.address, uniAmount);
        await tokenX.connect(miner1).approve(miningOneSideBoost.address, uniAmount);

        await tokenY.mint(miner1.address, qMax);
        await tokenY.connect(miner1).approve(miningOneSideBoost.address, qMax);
        
        
        await miningOneSideBoost.connect(miner1).depositWithuniToken(uniAmount, "0", "0xffffffff");

        var ts = await getTokenStatus(miningOneSideBoost, "1");
        console.log(ts.lockAmount);
        console.log(ts.lockAmount.length);
        
    });
});