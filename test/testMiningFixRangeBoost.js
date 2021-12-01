
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const { ethers } = require("hardhat");;
var uniV3 = require("./uniswap/deployUniV3.js");

async function deployToken(name, symbol) {
  var tokenFactory = await ethers.getContractFactory("TestToken");
  var token = await tokenFactory.deploy(name, symbol);
  return token;
}
async function attachToken(address) {
  var tokenFactory = await ethers.getContractFactory("TestToken");
  var token = await tokenFactory.attach(address);
  return token;
}
async function getToken() {

  // deploy token
  const tokenFactory = await ethers.getContractFactory("TestToken")
  tokenX = await tokenFactory.deploy('a', 'a');
  await tokenX.deployed();
  tokenY = await tokenFactory.deploy('b', 'b');
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

async function getMiningInfo(mining, miningID) {
  var amountLock;
  var vLiquidity;
  var lastTouchAccRewardPerShareX128;
  var uniPositionID;
  var uniLiquidity;
  var isUniPositionIDExternal;
  [
    amountLock, 
    vLiquidity, 
    lastTouchAccRewardPerShareX128, 
    uniPositionID, 
    uniLiquidity,
    isUniPositionIDExternal
  ] = await mining.miningInfos(miningID);
  return {
    amountLock: amountLock.toString(),
    vLiquidity: vLiquidity.toString(),
    lastTouchAccRewardPerShareX128: lastTouchAccRewardPerShareX128.toString(),
    uniPositionID: uniPositionID.toString(),
    uniLiquidity: uniLiquidity.toString(),
    isUniPositionIDExternal: isUniPositionIDExternal,
  }
}

async function getLiquidity(nftManager, tokenID) {
  var nonce;
  var operator;
  var token0;
  var token1;
  var fee;
  var tickLower;
  var tickUpper;
  var liquidity;
  var feeGrowthInside0LastX128;
  var feeGrowthInside1LastX128;
  var tokensOwed0;
  var tokensOwed1;
  [nonce, operator, token0, token1, fee,
    tickLower, tickUpper, liquidity,
    feeGrowthInside0LastX128, feeGrowthInside1LastX128,
    tokensOwed0, tokensOwed1] = await nftManager.positions(tokenID);
  return liquidity.toString();
}

async function checkPositionOwner(nftManager, tokenID, expectOwner) {
  var ownerAddress = await nftManager.ownerOf(tokenID);
  expect(ownerAddress).to.equal(expectOwner.address);
}

async function checkMiningInfo(mining, miningID, expectMiningInfo) {
  miningInfo = await getMiningInfo(mining, miningID);
  expect(miningInfo.amountLock).to.equal(expectMiningInfo.amountLock);
  expect(miningInfo.vLiquidity).to.equal(expectMiningInfo.vLiquidity);
  expect(miningInfo.lastTouchAccRewardPerShareX128).to.equal(expectMiningInfo.lastTouchAccRewardPerShareX128);
  expect(miningInfo.uniPositionID).to.equal(expectMiningInfo.uniPositionID);
  if (expectMiningInfo.uniLiquidity != undefined) {
    expect(miningInfo.uniLiquidity).to.equal(expectMiningInfo.uniLiquidity);
  }
  expect(miningInfo.isUniPositionIDExternal).to.equal(expectMiningInfo.isUniPositionIDExternal);
}

async function checkBalance(token, user, expectBalance) {
  var balance = await token.balanceOf(user.address);
  expect(balance.toString()).to.equal(expectBalance);
}

// async function checkBalanceRange(token, user, expectBalanceR, expectBalanceL) {
//   var balance = await token.balanceOf(user.address);
//   expect(balance.toString()).to.lessThanOrEqual(expectBalanceR.toString());
//   expect(balance.toString()).to.greaterThanOrEqual(expectBalanceL.toString());
// }
function floor(a) {
  return BigNumber(a.toFixed(0, 3));
}

function ceil(b) {
  return BigNumber(b.toFixed(0, 2));
}

function muldiv(a, b, c) {
  if (typeof(a) == 'string') {
    a = BigNumber(a);
  }
  d = a.times(b);
  if (d.mod(c).eq("0")) {
    return d.div(c);
  }
  return d.minus(d.mod(c)).div(c);
}

async function deployMining(
    uniNFTManager, token0, token1, fee, rewardInfos,
    iziTokenAddr, upperTick, lowerTick, startBlock, endBlock) {
    const MiningFactory = await ethers.getContractFactory('MiningFixRangeBoost');
    var mining = await MiningFactory.deploy(
        uniNFTManager.address, token0.address, token1.address, fee,
        rewardInfos, iziTokenAddr, upperTick, lowerTick, startBlock, endBlock);
    await mining.deployed();
    return mining;
}

async function nftMint(
    miner,
    uniNFTManager, tokenX, tokenY, tickLower, tickUpper,
    amountXDesired, amountYDesired
) {

    var mintParam = {
        token0: tokenX.address,
        token1: tokenY.address,
        fee: "3000",
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amountXDesired,
        amount1Desired: amountYDesired,
        amount0Min: "0",
        amount1Min: "0",
        recipient: miner.address,
        deadline: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    };
    await tokenX.transfer(miner.address, amountXDesired);
    await tokenX.connect(miner).approve(uniNFTManager.address, amountXDesired);

    await tokenY.transfer(miner.address, amountYDesired);
    await tokenY.connect(miner).approve(uniNFTManager.address, amountYDesired);
    await uniNFTManager.connect(miner).mint(mintParam);

}

async function getTokenStatus(mining, tokenId) {
    var vLiquidity, validVLiquidity, nIZI, lastTouchBlock, lastTouchAccRewardPerShare;
    [vLiquidity, validVLiquidity, nIZI, lastTouchBlock] = await mining.tokenStatus(tokenId);
    
    lastTouchAccRewardPerShare = await mining.lastTouchAccRewardPerShare(tokenId);

    return {
        vLiquidity: vLiquidity,
        validVLiquidity: validVLiquidity,
        nIZI: nIZI,
        lastTouchBlock: lastTouchBlock,
        lastTouchAccRewardPerShare: lastTouchAccRewardPerShare,
    };
}

async function checkTokenStatus(mining, tokenId, expectStatus) {
    var status = await getTokenStatus(mining, tokenId);
    expect(status.nIZI.toString()).to.equal(expectStatus.nIZI);
    expect(status.lastTouchBlock.toString()).to.equal(expectStatus.lastTouchBlock);
    for (var i = 0; i < expectStatus.lastTouchAccRewardPerShare.length; i ++) {
        expect(status.lastTouchAccRewardPerShare[i].toString()).to.equal(expectStatus.lastTouchAccRewardPerShare[i]);
    }
}

async function getRewardInfo(mining, num) {
    rewardInfos = []
    for (var i = 0; i < num; i ++) {
        var rewardToken, provider, accRewardPerShare, rewardPerBlock;
        [rewardToken, provider, accRewardPerShare, rewardPerBlock] = await mining.rewardInfos(i);
        rewardInfos.push({
            rewardToken: rewardToken,
            provider: provider,
            accRewardPerShare: accRewardPerShare,
            rewardPerBlock: rewardPerBlock,
        });
    }
    return rewardInfos;
}


async function collectReward(mining, rewardInfos, miner, tokenId) {
    var rewardAmount = [];
    var token = [];
    var balanceBefore = [];
    for (var i = 0; i < rewardInfos.length; i ++) {
        var tokenI = await attachToken(rewardInfos[i].rewardToken);
        var balanceBeforeI = (await tokenI.balanceOf(miner.address)).toString();
        token.push(tokenI);
        balanceBefore.push(balanceBeforeI);
    }
    await mining.connect(miner).collectReward(tokenId);
    for (var i = 0; i < rewardInfos.length; i ++) {
        var balanceAfter = (await token[i].balanceOf(miner.address)).toString();
        var delta = BigNumber(balanceAfter).minus(balanceBefore[i]).toFixed(0);
        rewardAmount.push(delta);
    }
    return rewardAmount;
}

async function setProvideer(mining, token, provider, amount) {
    await token.transfer(provider.address, amount);
    await token.connect(provider).approve(mining.address, amount);
}

function computeExpectReward(rewardInfos, tokenStatus) {
    rewards = [];
    var q128 = BigNumber(2).pow(128);
    for (var i = 0; i < rewardInfos.length; i ++) {
        var currScale = rewardInfos[i].accRewardPerShare;
        var lastScale = tokenStatus.lastTouchAccRewardPerShare[i];
        var deltaScale = BigNumber(currScale).minus(lastScale);
        reward = muldiv(tokenStatus.vLiquidity, deltaScale, q128);
        rewards.push(reward.toFixed(0));
    }
    return rewards;
}

function updateExpectGlobalStatus(rewardInfo, startBlock, endBlock, totalVLiquidity) {
    var rewardPerBlock = BigNumber(rewardInfo.rewardPerBlock);
    var tokenReward = rewardPerBlock.times(endBlock - startBlock);
    var originAccRewardPerShare = BigNumber(rewardInfo.accRewardPerShare);
    var q128 = BigNumber(2).pow(128);
    var deltaAccRewardPerShare = floor(tokenReward.times(q128).div(totalVLiquidity));
    var newAccRewardPerShare = originAccRewardPerShare.plus(deltaAccRewardPerShare);
    rewardInfo.accRewardPerShare = newAccRewardPerShare.toFixed(0);
}

describe("mining one side with boost", function () {
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
    var sqrtPriceX_96;

    var mining2RewardNoBoost;

    var q128;
    
    beforeEach(async function() {
      
        [signer, miner1, miner2, trader, tokenAProvider, tokenBProvider] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        weth = await tokenFactory.deploy('weth', 'weth');
        wethAddr = weth.address;

        var deployed = await uniV3.deployUniV3(wethAddr, signer);
        uniFactory = deployed.uniFactory;
        uniSwapRouter = deployed.uniSwapRouter;
        uniPositionManager = deployed.uniPositionManager;

        [tokenX, tokenY] = await getToken();
        sqrtPriceX_96 = "0x2000000000000000000000000";
        poolXYAddr = await uniPositionManager.createAndInitializePoolIfNecessary(tokenX.address, tokenY.address, "3000", sqrtPriceX_96);
        
        var tokenA = await deployToken("a", "a");
        var tokenB = await deployToken('b', 'b');

        rewardInfoA = {
            rewardToken: tokenA.address,
            provider: tokenAProvider.address,
            rewardPerBlock: "30000000000000",
            accRewardPerShare: "0",
        }
        rewardInfoB = {
            rewardToken: tokenB.address,
            provider: tokenBProvider.address,
            rewardPerBlock: "60000000000000",
            accRewardPerShare: "0",
        }
        
        startBlock = "0";
        endBlock = "10000000000000000000";

        q128 = BigNumber("2").pow(128);

        rewardLowerTick = '-5000';
        rewardUpperTick = '50000';

        mining2RewardNoBoost = await deployMining(uniPositionManager, tokenX, tokenY, "3000",
            [rewardInfoA, rewardInfoB], "0x0000000000000000000000000000000000000000", rewardUpperTick, rewardLowerTick,
            startBlock, endBlock
        );
        console.log("a");

        await setProvideer(mining2RewardNoBoost, tokenA, tokenAProvider, "1000000000000000000000000");
        console.log("b");
        await setProvideer(mining2RewardNoBoost, tokenB, tokenBProvider, "1000000000000000000000000");
        console.log("c");
        
    });
    
    it("mint with 2 rewards, no boost", async function () {

        var mining = mining2RewardNoBoost;
        console.log("before mint")

        await nftMint(
            miner1, uniPositionManager, tokenX, tokenY, 
            -12000, 27000, "10000000000000000", "10000000000000000");
        
        console.log("before deposit")
        await uniPositionManager.connect(miner1).approve(mining.address, "1");
        await mining.connect(miner1).deposit("1", "1000000000000000");
        console.log("after deposit")

        // phase 0
        var checkBlock0 = await ethers.provider.getBlockNumber();
        var queryRewardInfo = await getRewardInfo(mining, 2);
        expect(queryRewardInfo[0].accRewardPerShare.toString()).to.equal("0");
        expect(queryRewardInfo[1].accRewardPerShare.toString()).to.equal("0");
        var expectTokenStatus = {
            vLiquidity: undefined,
            nIZI: "0",
            lastTouchBlock: checkBlock0.toString(),
            lastTouchAccRewardPerShare: ["0", "0"]
        };
        await checkTokenStatus(mining, "1", expectTokenStatus);
      
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');

        var totalVLiquidity = (await mining.totalVLiquidity()).toString();

        // phase 1
        var tokenStatus = await getTokenStatus(mining, "1");
        expectTokenStatus.vLiquidity = tokenStatus.vLiquidity.toString();
        
        var rewards = await collectReward(mining, [rewardInfoA, rewardInfoB], miner1, "1");
        var checkBlock1 = await ethers.provider.getBlockNumber();
        
        updateExpectGlobalStatus(rewardInfoA, checkBlock0, checkBlock1, totalVLiquidity);
        updateExpectGlobalStatus(rewardInfoB, checkBlock0, checkBlock1, totalVLiquidity);

        var expectRewards = computeExpectReward([rewardInfoA, rewardInfoB], expectTokenStatus);
        // check rewards
        expect(rewards[0]).to.equal(expectRewards[0]);
        expect(rewards[1]).to.equal(expectRewards[1]);

        queryRewardInfo = await getRewardInfo(mining, 2);

        expect(queryRewardInfo[0].accRewardPerShare.toString()).to.equal(rewardInfoA.accRewardPerShare);
        expect(queryRewardInfo[1].accRewardPerShare.toString()).to.equal(rewardInfoB.accRewardPerShare);

        expectTokenStatus.lastTouchAccRewardPerShare = [rewardInfoA.accRewardPerShare, rewardInfoB.accRewardPerShare];
        expectTokenStatus.lastTouchBlock = checkBlock1.toString();

        await checkTokenStatus(mining, "1", expectTokenStatus);
    });
 
});