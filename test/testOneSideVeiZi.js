
const { BigNumber } = require("bignumber.js");
const { expect } = require("chai");
const hardhat = require('hardhat');
const { ethers } = require("hardhat");;

var uniV3 = require("./uniswap/deployUniV3.js");
var weth9 = require('./uniswap/deployWETH9.js');

async function getToken() {

  // deploy token
  const tokenFactory = await ethers.getContractFactory("TestToken")
  token = await tokenFactory.deploy('a', 'a', 18);
  await token.deployed();
  return token;
}

describe("test uniswap price oracle", function () {

    var signer, tester, receiver, provider;
    var iZi;
    var USDC;
    var veiZi;
    var mining;
    var BIT;

    beforeEach(async function() {
      
        [signer, tester, receiver, provider] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        USDC = await tokenFactory.deploy('USDC', 'USDC', 6);
        BIT = await tokenFactory.deploy('BIT', 'BIT', 18);

        iZi = await tokenFactory.deploy('iZi', 'iZi', 18);

        console.log('izi: ', iZi.address);
        console.log('usdc: ', USDC.address);

        const veiZiFactory = await ethers.getContractFactory('TestVeiZi');
        veiZi = await veiZiFactory.deploy();

        iZi.connect(tester).approve(veiZi.address, '1000000000000000000000000000000');
        iZi.mint(tester.address, '1000000000000000000000000000000');
        

        const weth = await weth9.deployWETH9(signer);
        const wethAddr = weth.address;

        const deployed = await uniV3.deployUniV3(wethAddr, signer);

        const uniPositionManager = deployed.uniPositionManager;
        const priceiZiByUSDCDecimal = 0.5;
        const priceiZiByUSDCSqrt = BigNumber(priceiZiByUSDCDecimal).times(10 ** 6).div(10 ** 18).sqrt();
        if (USDC.address.toLowerCase() < iZi.address.toLowerCase()) {
            const priceUSDCByiZiSqrt = BigNumber(1).div(priceiZiByUSDCSqrt);
            const priceUSDCByiZiSqrtX96 = priceUSDCByiZiSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(USDC.address, iZi.address, '3000', priceUSDCByiZiSqrtX96);
        } else {
            const priceiZiByUSDCSqrtX96 = priceiZiByUSDCSqrt.times(BigNumber(2).pow(96)).toFixed(0);
            await uniPositionManager.createAndInitializePoolIfNecessary(iZi.address, USDC.address, '3000', priceiZiByUSDCSqrtX96);
        }
        const blockNumber = await ethers.provider.getBlockNumber();
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
                    rewardPerBlock: BigNumber((10 ** 17)).toFixed(0),
                },
                {
                    rewardToken: BIT.address,
                    provider: provider.address,
                    accRewardPerShare: 0,
                    rewardPerBlock: BigNumber((10 ** 16)).toFixed(0),
                }
            ],
            '1',
            veiZi.address,
            blockNumber, blockNumber + 10000,
            '40',
            receiver.address,
            BigNumber(10000).times(10 ** 18).toFixed(0)
        ];
        console.log('args: ', args);
        const MiningFactory = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
        mining = await MiningFactory.deploy(...args);
        await BIT.mint(provider.address, '1000000000000000000000000000000');
        await iZi.mint(provider.address, '1000000000000000000000000000000');
        await BIT.connect(provider).approve(mining.address, '1000000000000000000000000000000');
        await iZi.connect(provider).approve(mining.address, '1000000000000000000000000000000');

        await USDC.mint(tester.address, '1000000000000000000000000000000');
        await USDC.connect(tester).approve(mining.address, '1000000000000000000000000000000');
        await iZi.mint(tester.address, '1000000000000000000000000000000');
        await iZi.connect(tester).approve(mining.address, '1000000000000000000000000000000');
    });
    
    it("simply create lock", async function () {
        
        const blockNumber = await ethers.provider.getBlockNumber();
        const MAXTIME = await veiZi.MAXTIME();

        await veiZi.connect(tester).stake('1', '10000', blockNumber + MAXTIME);
        
        const uniAmount = BigNumber(1000).times(10 ** 6).toFixed(0);
        await mining.connect(tester).depositWithuniToken(uniAmount, '0xffffffff');

        try {
        await mining.connect(tester).withdraw('1', false);
        } catch (e) {console.log('error:', e)}

        const pendingRewards = await mining.pendingRewards(tester.address);
        console.log('pending rewards: ', pendingRewards);
    });

});