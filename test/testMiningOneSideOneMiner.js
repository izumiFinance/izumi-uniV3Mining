
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

describe("mining one side", function () {
    var signer, miner1, miner2, trader, tokenZProvider, recipient1, recipient2;

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
      
        [signer, miner1, miner2, trader, tokenZProvider, recipient1, recipient2] = await ethers.getSigners();

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
        
        var tokenZ = await deployToken("z", "z");
        await tokenZ.transfer(tokenZProvider.address, "1000000000000000000000000");

        rewardInfo = {
          token: tokenZ.address,
          provider: tokenZProvider.address,
          tokenPerBlock: "30000000000",
        }
        
        startBlock = "0";
        endBlock = "10000000000000000000";

        q128 = BigNumber("2").pow(128);
        

    });
    
    it("check simply mining when tokenX is tokenUni", async function () {

      const MiningFactory = await ethers.getContractFactory("MiningOneSide");
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
      var tokenZ = await attachToken(rewardInfo.token);
      await tokenZ.connect(tokenZProvider).approve(mining.address, "1000000000000000000000000");
      console.log("after deploy");
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
        lastTouchAccRewardPerShareX128: "0",
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
      var tokenReward01 = BigNumber(rewardInfo.tokenPerBlock).times(checkBlock1 - checkBlock0);
      var expectAccRewardPerShare01 = floor(tokenReward01.times(q128).div(totalVLiquidity)).toFixed(0);
      var accRewardPerShare01 = (await mining.accRewardPerShareX128()).toString();
      expect(accRewardPerShare01).to.equal(expectAccRewardPerShare01);
      // check reward of miner1 after collect
      var expectMiner1Reward01 = muldiv(accRewardPerShare01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(tokenZ, recipient1, expectMiner1Reward01);
      // check provider's balance
      await checkBalance(tokenZ, tokenZProvider, BigNumber("1000000000000000000000000").minus(expectMiner1Reward01).toFixed(0));
      // check mining info after collect
      expectMiningInfo = {
        amountLock: "40000000000000000",
        vLiquidity: "10000000000000000",
        lastTouchAccRewardPerShareX128: expectAccRewardPerShare01,
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
      var tokenReward12 = BigNumber(rewardInfo.tokenPerBlock).times(checkBlock2 - checkBlock1);
      var accRewardPerShare12 = muldiv(tokenReward12, q128, BigNumber(totalVLiquidity));
      var expectAccRewardPerShare02 = accRewardPerShare12.plus(accRewardPerShare01).toFixed(0);
      var accRewardPerShare02 = (await mining.accRewardPerShareX128()).toString();

      expect(accRewardPerShare02).to.equal(expectAccRewardPerShare02);
      var expectMiner1Reward12 = muldiv(accRewardPerShare12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(tokenZ, recipient2, expectMiner1Reward12);
      await checkBalance(tokenY, recipient2, miner1AmountLockY);
      // check mining info after withdraw
      expectMiningInfo = {
        amountLock: "0",
        vLiquidity: "0",
        lastTouchAccRewardPerShareX128: expectAccRewardPerShare02,
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

      const MiningFactory = await ethers.getContractFactory("MiningOneSide");
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
      var tokenZ = await attachToken(rewardInfo.token);
      await tokenZ.connect(tokenZProvider).approve(mining.address, "1000000000000000000000000");
      console.log("after deploy");
      // miner1
      await tokenY.transfer(miner1.address, miner1AmountLockY);
      await tokenY.connect(miner1).approve(mining.address, miner1AmountLockY);
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
        lastTouchAccRewardPerShareX128: "0",
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
      var checkBlock1 = await ethers.provider.getBlockNumber();
      var tokenReward = BigNumber(rewardInfo.tokenPerBlock).times(checkBlock1 - checkBlock0);
      var expectAccRewardPerShare = muldiv(tokenReward, q128, BigNumber(totalVLiquidity)).toFixed(0);
      var accRewardPerShare = (await mining.accRewardPerShareX128()).toString();

      expect(accRewardPerShare).to.equal(expectAccRewardPerShare);
      var expectMiner1Reward = muldiv(accRewardPerShare, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(tokenZ, recipient2, expectMiner1Reward);
      await checkBalance(tokenY, recipient2, miner1AmountLockY);
      // check mining info after withdraw
      expectMiningInfo = {
        amountLock: "0",
        vLiquidity: "0",
        lastTouchAccRewardPerShareX128: expectAccRewardPerShare,
        uniPositionID: "0",
        isUniPositionIDExternal: true,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);
      // check total vliquidity

      totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal("0");
      
    });
    it("check simply mining when tokenY is tokenUni", async function () {
      var tickLeft = -500040;
      var tickRight = 13860;
      const MiningFactory = await ethers.getContractFactory("MiningOneSide");
      console.log("before deploy");
      mining = await MiningFactory.deploy(
        tokenY.address,
        tokenX.address,
        "3000",
        uniPositionManager.address,
        rewardInfo,
        startBlock,
        endBlock
      );
      var tokenZ = await attachToken(rewardInfo.token);
      await tokenZ.connect(tokenZProvider).approve(mining.address, "1000000000000000000000000");
      console.log("after deploy");
      // miner1
      await tokenX.transfer(miner1.address, "1000000000000000000");
      await tokenY.transfer(miner1.address, "1000000000000000000");
      await tokenX.connect(miner1).approve(mining.address, "2500000000000000");
      await tokenY.connect(miner1).approve(mining.address, "10000000000000000");

      var miner1AmountUniY = "10000000000000000";
      var miner1AmountLockX = "2500000000000000";
      var miner1VLiquidity = "10000000000000000";
      await mining.connect(miner1).mint(
        miner1AmountUniY,
        "1",
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      // check lock token balance of contract
      await checkBalance(tokenX, mining, miner1AmountLockX);

      var checkBlock0 = await ethers.provider.getBlockNumber();

      var expectTotalVLiquidity = "10000000000000000";
      var totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal(expectTotalVLiquidity);
      // check mining info after mint
      var expectMiningInfo = {
        amountLock: miner1AmountLockX,
        vLiquidity: miner1VLiquidity,
        lastTouchAccRewardPerShareX128: "0",
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
      var tokenReward01 = BigNumber(rewardInfo.tokenPerBlock).times(checkBlock1 - checkBlock0);
      var expectAccRewardPerShare01 = floor(tokenReward01.times(q128).div(totalVLiquidity)).toFixed(0);
      var accRewardPerShare01 = (await mining.accRewardPerShareX128()).toString();
      expect(accRewardPerShare01).to.equal(expectAccRewardPerShare01);
      // check reward of miner1 after collect
      var expectMiner1Reward01 = muldiv(accRewardPerShare01, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(tokenZ, recipient1, expectMiner1Reward01);
      // check mining info after collect
      expectMiningInfo = {
        amountLock: miner1AmountLockX,
        vLiquidity: miner1VLiquidity,
        lastTouchAccRewardPerShareX128: expectAccRewardPerShare01,
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
      var tokenReward12 = BigNumber(rewardInfo.tokenPerBlock).times(checkBlock2 - checkBlock1);
      var accRewardPerShare12 = muldiv(tokenReward12, q128, BigNumber(totalVLiquidity));
      var accRewardPerShare02 = accRewardPerShare12.plus(accRewardPerShare01).toFixed(0);
      var expectAccRewardPerShare02 = (await mining.accRewardPerShareX128()).toString();

      expect(accRewardPerShare02).to.equal(expectAccRewardPerShare02);
      var expectMiner1Reward12 = muldiv(accRewardPerShare12, BigNumber(miner1VLiquidity), q128).toFixed(0);
      await checkBalance(tokenZ, recipient2, expectMiner1Reward12);
      await checkBalance(tokenX, recipient2, miner1AmountLockX);
      // check mining info after withdraw
      expectMiningInfo = {
        amountLock: "0",
        vLiquidity: "0",
        lastTouchAccRewardPerShareX128: expectAccRewardPerShare02,
        uniPositionID: "0",
        isUniPositionIDExternal: false,
      };
      await checkMiningInfo(mining, "0", expectMiningInfo);
      // check total vliquidity

      totalVLiquidity = (await mining.totalVLiquidity()).toString();
      expect(totalVLiquidity).to.equal("0");
      
    });
    
});