
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
    const MiningFactory = await ethers.getContractFactory('MiningDynamicRangeBoost');
    var mining = await MiningFactory.deploy(
        poolParams, rewardInfos, '0x0000000000000000000000000000000000000000', 100000, 1000000000000
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

    var tokenX;
    var tokenY;

    var sqrtPriceUniByLockX96;
    var poolAddr;

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

    var miningDynamicRangeBoost;
    
    beforeEach(async function() {
      
        [signer, miner1, miner2, trader, provider0, provider1, recipient1, recipient2] = await ethers.getSigners();

        weth = await weth9.deployWETH9(signer);
        wethAddr = weth.address;

        var deployed = await uniV3.deployUniV3(wethAddr, signer);
        uniFactory = deployed.uniFactory;
        uniSwapRouter = deployed.uniSwapRouter;
        uniPositionManager = deployed.uniPositionManager;

        tokenX = weth;
        tokenY = await deployToken('a', 'a');

        sqrtPriceUniByLockX96 = '0x1000000000000000000000000';

        if (tokenX.address.toLowerCase() > tokenY.address.toLowerCase()) {
            var tmp = tokenX;
            tokenX = tokenY;
            tokenY = tmp;
        }

        var createPoolTx = await uniPositionManager.createAndInitializePoolIfNecessary(tokenX.address, tokenY.address, "3000", sqrtPriceUniByLockX96);
        poolAddr = await uniFactory.getPool(tokenX.address, tokenY.address, "3000");
        console.log('pool addr: ', poolAddr);
        var pool = await uniV3.getPool(signer, poolAddr);
        console.log('get pool');
        var tx = await pool.increaseObservationCardinalityNext(100);

       console.log("after inc: ", tx);
        var token0 = await deployToken("z0", "z0");
        await token0.transfer(provider0.address, "1000000000000000000000000");

        rewardInfo0.rewardToken = token0.address;
        rewardInfo0.rewardPerBlock = '30000000000';
        rewardInfo0.provider = provider0.address;
        rewardInfo0.accRewardPerShare = '0';

        console.log('info');

        poolParams = {
            uniV3NFTManager: uniPositionManager.address,
            token0:tokenX.address,
            token1:tokenY.address,
            fee:'3000',
        }
        miningDynamicRangeBoost = await deployMining(poolParams, [rewardInfo0])
        console.log('deploy');

        q128 = BigNumber("2").pow(128);
        

    });
    
    it("check simply deposit / withdraw", async function () {
        console.log('eth of miner1: ', (await ethers.provider.getBalance(miner1.address)).toString());
        if (tokenX.address.toLowerCase() != wethAddr.toLowerCase()) {
            await tokenX.mint(miner1.address, '100000000000000000000');
        }
        if (tokenY.address.toLowerCase() != wethAddr.toLowerCase()) {
            await tokenY.mint(miner1.address, '100000000000000000000');
        }
        await tokenY.connect(miner1).approve(miningDynamicRangeBoost.address, '100000000000000000000');
        await tokenX.connect(miner1).approve(miningDynamicRangeBoost.address, '100000000000000000000');

        await miningDynamicRangeBoost.connect(miner1).deposit('100000000000000000000', '100000000000000000000', '0', {value: '100000000000000000000'});

        idList = await miningDynamicRangeBoost.getTokenIds(miner1.address);
        console.log('idList: ', idList);

        await miningOneSideBoost.connect(miner1).withdraw(idList[0], false);

        // console.log('weth balance: ', (await weth.balanceOf(miner1.address)).toString());
    });
    
});