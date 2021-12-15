
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const { ethers } = require("hardhat");;
var uniV3 = require("./uniswap/deployUniV3.js");
var weth9 = require('./uniswap/deployWETH9.js');

async function deployToken(name, symbol) {
  var tokenFactory = await ethers.getContractFactory("TestToken");
  var token = await tokenFactory.deploy(name, symbol, 18);
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

  console.log("tokenX: " + tokenX.address.toLowerCase());
  console.log("tokenY: " + tokenY.address.toLowerCase());

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
  console.log("txAddr: " + txAddr);
  console.log("tyAddr: " + tyAddr);

  console.log("tx: " + tokenX.address);
  console.log("ty: " + tokenY.address);
  return [tokenX, tokenY];
}

async function getMiningInfo(mining, miningID) {
  var amountLock;
  var vLiquidity;
  var lastTouchAccRewardPerShare0;
  var lastTouchAccRewardPerShare1;
  var uniPositionID;
  var uniLiquidity;
  var isUniPositionIDExternal;
  [
    amountLock, 
    vLiquidity, 
    lastTouchAccRewardPerShare0, 
    lastTouchAccRewardPerShare1,
    uniPositionID, 
    uniLiquidity,
    isUniPositionIDExternal
  ] = await mining.miningInfos(miningID);
  return {
    amountLock: amountLock.toString(),
    vLiquidity: vLiquidity.toString(),
    lastTouchAccRewardPerShare0: lastTouchAccRewardPerShare0.toString(),
    lastTouchAccRewardPerShare1: lastTouchAccRewardPerShare1.toString(),
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
  expect(miningInfo.lastTouchAccRewardPerShare0).to.equal(expectMiningInfo.lastTouchAccRewardPerShare0);
  expect(miningInfo.lastTouchAccRewardPerShare1).to.equal(expectMiningInfo.lastTouchAccRewardPerShare1);
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

async function deployMining(poolParams, rewardInfos) {
    const MiningFactory = await ethers.getContractFactory('MiningOneSideBoost');
    var mining = await MiningFactory.deploy(
        poolParams, rewardInfos, '3', '0x0000000000000000000000000000000000000000', 100000, 1000000000000
    );
    await mining.deployed();
    return mining;
}
describe("mining one side with 2 rewards", function () {
    var signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2;

    var weth;
    var wethAddr;

    var uniFactory;
    var uniSwapRouter;
    var uniPositionManager;

    var tokenUni;
    var tokenLock;

    var sqrtPriceUniByLockX96;
    var poolUniLockAddr;

    var rewardInfo0 = {
        rewardToken: undefined,
        provider: undefined,
        rewardPerBlock: undefined,
        accRewardPerShare: undefined,
      };
    var poolParams = {
        uniV3NFTManager: undefined,
        uniTokenAddr:undefined,
        lockTokenAddr:undefined,
        fee:undefined,
    };

    var sqrtPriceX_96;

    var mining;

    var q128;

    var miningOneSideBoost;
    
    beforeEach(async function() {
      
        [signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2] = await ethers.getSigners();

        weth = await weth9.deployWETH9(signer);
        wethAddr = weth.address;

        var deployed = await uniV3.deployUniV3(wethAddr, signer);
        uniFactory = deployed.uniFactory;
        uniSwapRouter = deployed.uniSwapRouter;
        uniPositionManager = deployed.uniPositionManager;

        tokenUni = weth;
        tokenLock = await deployToken('a', 'a');

        sqrtPriceUniByLockX96 = '0x1000000000000000000000000';

        if (tokenUni.address.toLowerCase() < tokenLock.address.toLowerCase()) {
            poolUniLockAddr = await uniPositionManager.createAndInitializePoolIfNecessary(tokenUni.address, tokenLock.address, "3000", sqrtPriceUniByLockX96);
        } else {
            poolUniLockAddr = await uniPositionManager.createAndInitializePoolIfNecessary(tokenLock.address, tokenUni.address, "3000", sqrtPriceUniByLockX96);
        }
        
        
        var token0 = await deployToken("z0", "z0");
        await token0.transfer(provider0.address, "1000000000000000000000000");

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            uniTokenAddr:tokenUni.address,
            lockTokenAddr:tokenLock.address,
            fee:'3000',
        }
        miningOneSideBoost = await deployMining(poolParams, [rewardInfo0])

        q128 = BigNumber("2").pow(128);
        

    });
    
    it("check simply deposit / withdraw", async function () {
        console.log('eth of miner1: ', (await ethers.provider.getBalance(miner1.address)).toString());
        await tokenLock.mint(miner1.address, '100000000000000000000');
        await tokenLock.connect(miner1).approve(miningOneSideBoost.address, '100000000000000000000');

        console.log('token lock of miner1: ', await tokenLock.balanceOf(miner1.address));

        await miningOneSideBoost.connect(miner1).depositWithuniToken('500000000000000000', '0', '0xffffffff', {value: '500000000000000000'});

        idList = await miningOneSideBoost.getTokenIds(miner1.address);
        console.log('idList: ', idList);

        await miningOneSideBoost.connect(miner1).withdraw(idList[0], false);

        // console.log('weth balance: ', (await weth.balanceOf(miner1.address)).toString());
    });
    
});