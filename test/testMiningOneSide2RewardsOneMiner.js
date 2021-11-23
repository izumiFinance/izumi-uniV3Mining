
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

describe("mining one side with 2 rewards", function () {
    var signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2;

    var weth;
    var wethAddr;

    var uniFactory;
    var uniSwapRouter;
    var uniPositionManager;

    var tokenX;
    var tokenY;

    var rewardInfo = {
      token: undefined,
      provider: undefined,
      tokenPerBlock: undefined,
      endBlock: undefined,
      startBlock: undefined,
    };

    var startBlock;
    var endBlock;

    var poolXYAddr;
    var sqrtPriceX_96;

    var mining;

    var q128;
    
    beforeEach(async function() {
      
        [signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2] = await ethers.getSigners();

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
        
        var token0 = await deployToken("z0", "z0");
        await token0.transfer(provider0.address, "1000000000000000000000000");

        var token1 = await deployToken("z1", "z1");
        await token1.transfer(provider1.address, "1000000000000000000000000");

        rewardInfo = {
          token0: token0.address,
          provider0: provider0.address,
          tokenPerBlock0: "30000000000",

          token1: token1.address,
          provider1: provider1.address,
          tokenPerBlock1: "50000000000",
        }
        
        startBlock = "0";
        endBlock = "10000000000000000000";

        q128 = BigNumber("2").pow(128);
        

    });
    
    it("check simply mining when tokenX is tokenUni", async function () {

      const MiningFactory = await ethers.getContractFactory("MiningOneSide2Rewards");

      mining = await MiningFactory.deploy(
        tokenX.address,
        tokenY.address,
        "3000",
        uniPositionManager.address,
        rewardInfo,
        startBlock,
        endBlock
      );
      var token0 = await attachToken(rewardInfo.token0);
      await token0.connect(provider0).approve(mining.address, "1000000000000000000000000");
      var token1 = await attachToken(rewardInfo.token1);
      await token1.connect(provider1).approve(mining.address, "1000000000000000000000000");

      // miner1
      await tokenX.transfer(miner1.address, "1000000000000000000");
      await tokenY.transfer(miner1.address, "1000000000000000000");
      await tokenX.connect(miner1).approve(mining.address, "10000000000000000");
      await tokenY.connect(miner1).approve(mining.address, "40000000000000000");

      var miner1AmountUniX = "10000000000000000";
      var miner1AmountLockY = "40000000000000000";
      var miner1VLiquidity = "10000000000000000";
      await mining.connect(miner1).mint(
        miner1AmountUniX,
        "1",
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      // check lock balance of contract
      await checkBalance(tokenY, mining, miner1AmountLockY);
      var checkBlock0 = await ethers.provider.getBlockNumber();

      var expectTotalVLiquidity = "10000000000000000";
      var totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal(expectTotalVLiquidity);
      // check mining info after mint
      var expectMiningInfo = {
        amountLock: miner1AmountLockY,
        vLiquidity: miner1AmountUniX,
        lastTouchAccRewardPerShare0: "0",
        lastTouchAccRewardPerShare1: "0",
        uniPositionID: "1",
        isUniPositionIDExternal: false,
      };

      await checkMiningInfo(mining, "0", expectMiningInfo);

      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await mining.connect(miner1).collect("0", recipient1.address);
      var checkBlock1 = await ethers.provider.getBlockNumber();

      var tokenReward0_01 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock1 - checkBlock0);
      var tokenReward1_01 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock1 - checkBlock0);
      var expectAccRewardPerShare0_01 = floor(tokenReward0_01.times(q128).div(totalVLiquidity)).toFixed(0);
      var expectAccRewardPerShare1_01 = floor(tokenReward1_01.times(q128).div(totalVLiquidity)).toFixed(0);

      var accRewardPerShare0_01 = (await mining.accRewardPerShare0()).toString();
      var accRewardPerShare1_01 = (await mining.accRewardPerShare1()).toString();
      expect(accRewardPerShare0_01).to.equal(expectAccRewardPerShare0_01);
      expect(accRewardPerShare1_01).to.equal(expectAccRewardPerShare1_01);
      // check reward of miner1 after collect
      var expectMiner1Reward0_01 = muldiv(accRewardPerShare0_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      var expectMiner1Reward1_01 = muldiv(accRewardPerShare1_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(token0, recipient1, expectMiner1Reward0_01);
      await checkBalance(token1, recipient1, expectMiner1Reward1_01);
      // check provider's balance
      await checkBalance(token0, provider0, BigNumber("1000000000000000000000000").minus(expectMiner1Reward0_01).toFixed(0));
      await checkBalance(token1, provider1, BigNumber("1000000000000000000000000").minus(expectMiner1Reward1_01).toFixed(0));
      // check mining info after collect
      expectMiningInfo = {
        amountLock: "40000000000000000",
        vLiquidity: "10000000000000000",
        lastTouchAccRewardPerShare0: expectAccRewardPerShare0_01,
        lastTouchAccRewardPerShare1: expectAccRewardPerShare1_01,
        uniPositionID: "1",
        isUniPositionIDExternal: false,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);

      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');

      await mining.connect(miner1).withdraw(
        "0",
        recipient2.address,
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        false
      );

      var checkBlock2 = await ethers.provider.getBlockNumber();
      var tokenReward0_12 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock2 - checkBlock1);
      var tokenReward1_12 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock2 - checkBlock1);

      var accRewardPerShare0_12 = muldiv(tokenReward0_12, q128, BigNumber(totalVLiquidity));
      var expectAccRewardPerShare0_02 = accRewardPerShare0_12.plus(expectAccRewardPerShare0_01).toFixed(0);

      var accRewardPerShare1_12 = muldiv(tokenReward1_12, q128, BigNumber(totalVLiquidity));
      var expectAccRewardPerShare1_02 = accRewardPerShare1_12.plus(expectAccRewardPerShare1_01).toFixed(0);

      var accRewardPerShare0_02 = (await mining.accRewardPerShare0()).toString();
      var accRewardPerShare1_02 = (await mining.accRewardPerShare1()).toString();

      expect(accRewardPerShare0_02).to.equal(expectAccRewardPerShare0_02);
      expect(accRewardPerShare1_02).to.equal(expectAccRewardPerShare1_02);
      var expectMiner1Reward0_12 = muldiv(accRewardPerShare0_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      var expectMiner1Reward1_12 = muldiv(accRewardPerShare1_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(token0, recipient2, expectMiner1Reward0_12);
      await checkBalance(token1, recipient2, expectMiner1Reward1_12);
      await checkBalance(tokenY, recipient2, miner1AmountLockY);
      // check mining info after withdraw
      expectMiningInfo = {
        amountLock: "0",
        vLiquidity: "0",
        lastTouchAccRewardPerShare0: expectAccRewardPerShare0_02,
        lastTouchAccRewardPerShare1: expectAccRewardPerShare1_02,
        uniPositionID: "0",
        isUniPositionIDExternal: false,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);
      // check total vliquidity

      totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal("0");
      
    });

    it("check simply mining when tokenX is tokenUni, and mining with NFT", async function () {
      
      var tickLeft = 13920;
      var tickRight = 500040;

      var miner1AmountUniX = "10000000000000000";
      var miner1AmountLockY = "40000000000000000";
      var miner1VLiquidity = "10000000000000000";

      var mintParam = {
        token0: tokenX.address,
        token1: tokenY.address,
        fee: "3000",
        tickLower: tickLeft,
        tickUpper: tickRight,
        amount0Desired: miner1AmountUniX,
        amount1Desired: "0",
        amount0Min: "1",
        amount1Min: "0",
        recipient: miner1.address,
        deadline: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      }
      await tokenX.transfer(miner1.address, "1000000000000000000");
      await tokenX.connect(miner1).approve(uniPositionManager.address, "10000000000000000");
      await uniPositionManager.connect(miner1).mint(mintParam);
      var posID = "1";
      await checkPositionOwner(uniPositionManager, posID, miner1);

      const MiningFactory = await ethers.getContractFactory("MiningOneSide2Rewards");
      console.log("before deploy");
      mining = await MiningFactory.deploy(
        tokenX.address,
        tokenY.address,
        "3000",
        uniPositionManager.address,
        rewardInfo,
        startBlock,
        endBlock
      );
      var token0 = await attachToken(rewardInfo.token0);
      await token0.connect(provider0).approve(mining.address, "1000000000000000000000000");
      var token1 = await attachToken(rewardInfo.token1);
      await token1.connect(provider1).approve(mining.address, "1000000000000000000000000");

      // miner1
      await tokenY.transfer(miner1.address, "1000000000000000000");
      await tokenY.connect(miner1).approve(mining.address, "40000000000000000");

      var miner1AmountUniX = "10000000000000000";
      var miner1AmountLockY = "40000000000000000";
      var miner1VLiquidity = "10000000000000000";

      await uniPositionManager.connect(miner1).approve(mining.address, posID);
      // mint with existing nft
      await mining.connect(miner1).mintWithExistingNFT(posID, "1");
      await checkPositionOwner(uniPositionManager, posID, mining);
      // check lock balance of contract
      await checkBalance(tokenY, mining, miner1AmountLockY);
      var checkBlock0 = await ethers.provider.getBlockNumber();

      var expectTotalVLiquidity = "10000000000000000";
      var totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal(expectTotalVLiquidity);
      // check mining info after mint
      var expectMiningInfo = {
        amountLock: miner1AmountLockY,
        vLiquidity: miner1AmountUniX,
        lastTouchAccRewardPerShare0: "0",
        lastTouchAccRewardPerShare1: "0",
        uniPositionID: posID,
        isUniPositionIDExternal: true,
      };

      await checkMiningInfo(mining, "0", expectMiningInfo);

      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await mining.connect(miner1).collect("0", recipient1.address);
      var checkBlock1 = await ethers.provider.getBlockNumber();

      var tokenReward0_01 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock1 - checkBlock0);
      var tokenReward1_01 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock1 - checkBlock0);
      var expectAccRewardPerShare0_01 = floor(tokenReward0_01.times(q128).div(totalVLiquidity)).toFixed(0);
      var expectAccRewardPerShare1_01 = floor(tokenReward1_01.times(q128).div(totalVLiquidity)).toFixed(0);

      var accRewardPerShare0_01 = (await mining.accRewardPerShare0()).toString();
      var accRewardPerShare1_01 = (await mining.accRewardPerShare1()).toString();
      expect(accRewardPerShare0_01).to.equal(expectAccRewardPerShare0_01);
      expect(accRewardPerShare1_01).to.equal(expectAccRewardPerShare1_01);
      // check reward of miner1 after collect
      var expectMiner1Reward0_01 = muldiv(accRewardPerShare0_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      var expectMiner1Reward1_01 = muldiv(accRewardPerShare1_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(token0, recipient1, expectMiner1Reward0_01);
      await checkBalance(token1, recipient1, expectMiner1Reward1_01);
      // check provider's balance
      await checkBalance(token0, provider0, BigNumber("1000000000000000000000000").minus(expectMiner1Reward0_01).toFixed(0));
      await checkBalance(token1, provider1, BigNumber("1000000000000000000000000").minus(expectMiner1Reward1_01).toFixed(0));
      // check mining info after collect
      expectMiningInfo = {
        amountLock: "40000000000000000",
        vLiquidity: "10000000000000000",
        lastTouchAccRewardPerShare0: expectAccRewardPerShare0_01,
        lastTouchAccRewardPerShare1: expectAccRewardPerShare1_01,
        uniPositionID: posID,
        isUniPositionIDExternal: true,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);

      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');
      await ethers.provider.send('evm_mine');

      await mining.connect(miner1).withdraw(
        "0",
        recipient2.address,
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        false
      );

      await checkPositionOwner(uniPositionManager, posID, recipient2);

      var checkBlock2 = await ethers.provider.getBlockNumber();
      var tokenReward0_12 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock2 - checkBlock1);
      var tokenReward1_12 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock2 - checkBlock1);

      var accRewardPerShare0_12 = muldiv(tokenReward0_12, q128, BigNumber(totalVLiquidity));
      var expectAccRewardPerShare0_02 = accRewardPerShare0_12.plus(expectAccRewardPerShare0_01).toFixed(0);

      var accRewardPerShare1_12 = muldiv(tokenReward1_12, q128, BigNumber(totalVLiquidity));
      var expectAccRewardPerShare1_02 = accRewardPerShare1_12.plus(expectAccRewardPerShare1_01).toFixed(0);

      var accRewardPerShare0_02 = (await mining.accRewardPerShare0()).toString();
      var accRewardPerShare1_02 = (await mining.accRewardPerShare1()).toString();

      expect(accRewardPerShare0_02).to.equal(expectAccRewardPerShare0_02);
      expect(accRewardPerShare1_02).to.equal(expectAccRewardPerShare1_02);
      var expectMiner1Reward0_12 = muldiv(accRewardPerShare0_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      var expectMiner1Reward1_12 = muldiv(accRewardPerShare1_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(token0, recipient2, expectMiner1Reward0_12);
      await checkBalance(token1, recipient2, expectMiner1Reward1_12);
      await checkBalance(tokenY, recipient2, miner1AmountLockY);
      // check mining info after withdraw
      expectMiningInfo = {
        amountLock: "0",
        vLiquidity: "0",
        lastTouchAccRewardPerShare0: expectAccRewardPerShare0_02,
        lastTouchAccRewardPerShare1: expectAccRewardPerShare1_02,
        uniPositionID: "0",
        isUniPositionIDExternal: true,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);
      // check total vliquidity

      totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal("0");
    });

    it("check simply mining when tokenY is tokenUni", async function () {
        const MiningFactory = await ethers.getContractFactory("MiningOneSide2Rewards");

        mining = await MiningFactory.deploy(
          tokenY.address,
          tokenX.address,
          "3000",
          uniPositionManager.address,
          rewardInfo,
          startBlock,
          endBlock
        );
        var token0 = await attachToken(rewardInfo.token0);
        await token0.connect(provider0).approve(mining.address, "1000000000000000000000000");
        var token1 = await attachToken(rewardInfo.token1);
        await token1.connect(provider1).approve(mining.address, "1000000000000000000000000");
  
        // miner1
        await tokenX.transfer(miner1.address, "1000000000000000000");
        await tokenY.transfer(miner1.address, "1000000000000000000");
        await tokenX.connect(miner1).approve(mining.address, "10000000000000000");
        await tokenY.connect(miner1).approve(mining.address, "40000000000000000");
  
        var miner1AmountUniY = "10000000000000000";
        var miner1AmountLockX = "2500000000000000";
        var miner1VLiquidity = "10000000000000000";
        await mining.connect(miner1).mint(
          miner1AmountUniY,
          "1",
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        );
        // check lock balance of contract
        await checkBalance(tokenX, mining, miner1AmountLockX);
        var checkBlock0 = await ethers.provider.getBlockNumber();
  
        var expectTotalVLiquidity = "10000000000000000";
        var totalVLiquidity = (await mining.totalVLiquidity()).toString();
        expect(totalVLiquidity).to.equal(expectTotalVLiquidity);
        // check mining info after mint
        var expectMiningInfo = {
          amountLock: miner1AmountLockX,
          vLiquidity: miner1AmountUniY,
          lastTouchAccRewardPerShare0: "0",
          lastTouchAccRewardPerShare1: "0",
          uniPositionID: "1",
          isUniPositionIDExternal: false,
        };
  
        await checkMiningInfo(mining, "0", expectMiningInfo);
  
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await mining.connect(miner1).collect("0", recipient1.address);
        var checkBlock1 = await ethers.provider.getBlockNumber();
  
        var tokenReward0_01 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock1 - checkBlock0);
        var tokenReward1_01 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock1 - checkBlock0);
        var expectAccRewardPerShare0_01 = floor(tokenReward0_01.times(q128).div(totalVLiquidity)).toFixed(0);
        var expectAccRewardPerShare1_01 = floor(tokenReward1_01.times(q128).div(totalVLiquidity)).toFixed(0);
  
        var accRewardPerShare0_01 = (await mining.accRewardPerShare0()).toString();
        var accRewardPerShare1_01 = (await mining.accRewardPerShare1()).toString();
        expect(accRewardPerShare0_01).to.equal(expectAccRewardPerShare0_01);
        expect(accRewardPerShare1_01).to.equal(expectAccRewardPerShare1_01);
        // check reward of miner1 after collect
        var expectMiner1Reward0_01 = muldiv(accRewardPerShare0_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
        var expectMiner1Reward1_01 = muldiv(accRewardPerShare1_01, BigNumber(miner1VLiquidity), q128).toFixed(0);
        await checkBalance(token0, recipient1, expectMiner1Reward0_01);
        await checkBalance(token1, recipient1, expectMiner1Reward1_01);
        // check provider's balance
        await checkBalance(token0, provider0, BigNumber("1000000000000000000000000").minus(expectMiner1Reward0_01).toFixed(0));
        await checkBalance(token1, provider1, BigNumber("1000000000000000000000000").minus(expectMiner1Reward1_01).toFixed(0));
        // check mining info after collect
        expectMiningInfo = {
            amountLock: miner1AmountLockX,
            vLiquidity: miner1AmountUniY,
          lastTouchAccRewardPerShare0: expectAccRewardPerShare0_01,
          lastTouchAccRewardPerShare1: expectAccRewardPerShare1_01,
          uniPositionID: "1",
          isUniPositionIDExternal: false,
        };
        await checkMiningInfo(mining, "0", expectMiningInfo);
  
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
        await ethers.provider.send('evm_mine');
  
        await mining.connect(miner1).withdraw(
          "0",
          recipient2.address,
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          false
        );
  
        var checkBlock2 = await ethers.provider.getBlockNumber();
        var tokenReward0_12 = BigNumber(rewardInfo.tokenPerBlock0).times(checkBlock2 - checkBlock1);
        var tokenReward1_12 = BigNumber(rewardInfo.tokenPerBlock1).times(checkBlock2 - checkBlock1);
  
        var accRewardPerShare0_12 = muldiv(tokenReward0_12, q128, BigNumber(totalVLiquidity));
        var expectAccRewardPerShare0_02 = accRewardPerShare0_12.plus(expectAccRewardPerShare0_01).toFixed(0);
  
        var accRewardPerShare1_12 = muldiv(tokenReward1_12, q128, BigNumber(totalVLiquidity));
        var expectAccRewardPerShare1_02 = accRewardPerShare1_12.plus(expectAccRewardPerShare1_01).toFixed(0);
  
        var accRewardPerShare0_02 = (await mining.accRewardPerShare0()).toString();
        var accRewardPerShare1_02 = (await mining.accRewardPerShare1()).toString();
  
        expect(accRewardPerShare0_02).to.equal(expectAccRewardPerShare0_02);
        expect(accRewardPerShare1_02).to.equal(expectAccRewardPerShare1_02);
        var expectMiner1Reward0_12 = muldiv(accRewardPerShare0_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
        var expectMiner1Reward1_12 = muldiv(accRewardPerShare1_12, BigNumber(miner1VLiquidity), q128).toFixed(0);
        await checkBalance(token0, recipient2, expectMiner1Reward0_12);
        await checkBalance(token1, recipient2, expectMiner1Reward1_12);
        await checkBalance(tokenX, recipient2, miner1AmountLockX);
        // check mining info after withdraw
        expectMiningInfo = {
          amountLock: "0",
          vLiquidity: "0",
          lastTouchAccRewardPerShare0: expectAccRewardPerShare0_02,
          lastTouchAccRewardPerShare1: expectAccRewardPerShare1_02,
          uniPositionID: "0",
          isUniPositionIDExternal: false,
        };
        await checkMiningInfo(mining, "0", expectMiningInfo);
        // check total vliquidity
  
        totalVLiquidity = (await mining.totalVLiquidity()).toString();
        expect(totalVLiquidity).to.equal("0");
    });
    
});