
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
        const tx = await mining.connect(tester).collectRewards();
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

async function modifyProvider(mining, rewardIdx, deployer, providerAddr) {
    try {
        await mining.connect(deployer).modifyProvider(rewardIdx, providerAddr);
        return true;
    } catch (err) {
        return false;
    }
}
describe("test uniswap price oracle", function () {

    var signer, tester, receiver, provider;
    var iZi;
    var veiZi;
    var mining;
    var BIT;
    var token0, token1;
    var hugeAmount;
    var iZiRewardPerBlock, BITRewardPerBlock;
    var rewardPerBlockMap;
    var uniPositionManager;

    var leftSqrtPriceX96;
    var rightSqrtPriceX96;

    beforeEach(async function() {

        hugeAmount = '1000000000000000000000000000000';
      
        [signer, tester, miner, receiver, provider, provider2, trader] = await ethers.getSigners();

        // a fake weth
        const tokenFactory = await ethers.getContractFactory("TestToken");
        token0 = await tokenFactory.deploy('USDC', 'USDC', 6);
        token1 = await tokenFactory.deploy('USDT', 'USDT', 6);
        if (token0.address.toLowerCase() > token1.address.toLowerCase()) {
            const tmp = token0;
            token0 = token1;
            token1 = tmp;
        }

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
        await uniFactory.enableFeeAmount(100, 1);
        await uniPositionManager.createAndInitializePoolIfNecessary(token0.address, token1.address, '100', BigNumber(2).pow(96).toFixed(0));

        const poolAddr = await uniFactory.getPool(token0.address, token1.address, '100');
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
                token0: token0.address,
                token1: token1.address,
                fee: '100'
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
            10, -10,
            blockNumber, blockNumber + 10000,
            '40',
            receiver.address,
            BigNumber(10000).times(10 ** 18).toFixed(0)
        ];

        const MiningFactory = await hardhat.ethers.getContractFactory("MiningFixRangeBoostVeiZi");
        mining = await MiningFactory.deploy(...args);
        await BIT.mint(provider.address, hugeAmount);
        await iZi.mint(provider.address, hugeAmount);
        await BIT.connect(provider).approve(mining.address, hugeAmount);
        await iZi.connect(provider).approve(mining.address, hugeAmount);

        await token0.mint(tester.address, hugeAmount);
        await token0.connect(tester).approve(mining.address, hugeAmount);
        await token0.connect(tester).approve(uniPositionManager.address, hugeAmount);
        await token1.mint(tester.address, hugeAmount);
        await token1.connect(tester).approve(mining.address, hugeAmount);
        await token1.connect(tester).approve(uniPositionManager.address, hugeAmount);

        // a big miner
        await token0.mint(miner.address, hugeAmount);
        await token0.connect(miner).approve(mining.address, hugeAmount);
        await token0.connect(miner).approve(uniPositionManager.address, hugeAmount);
        await token1.mint(miner.address, hugeAmount);
        await token1.connect(miner).approve(mining.address, hugeAmount);
        await token1.connect(miner).approve(uniPositionManager.address, hugeAmount);

        await token0.mint(trader.address, hugeAmount);
        await token0.connect(trader).approve(uniSwapRouter.address, hugeAmount);
        await token1.mint(trader.address, hugeAmount);
        await token1.connect(trader).approve(uniSwapRouter.address, hugeAmount);

        // miner mint veiZi
        blockNumber = await ethers.provider.getBlockNumber();
        const MAXTIME = await veiZi.MAXTIME();
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);

        await uniPositionManager.connect(miner).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -8,
            tickUpper: 20,
            amount0Desired: decimal2Amount(30000, 6),
            amount1Desired: decimal2Amount(30000, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: miner.address,
            deadline: '0xffffffff',
        });
        await uniPositionManager.connect(tester).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -20,
            tickUpper: 5,
            amount0Desired: decimal2Amount(20000, 6),
            amount1Desired: decimal2Amount(20000, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: tester.address,
            deadline: '0xffffffff',
        });
        await uniPositionManager.connect(tester).mint({
            token0: token0.address,
            token1: token1.address,
            fee: '100',
            tickLower: -9,
            tickUpper: 9,
            amount0Desired: decimal2Amount(5000, 6),
            amount1Desired: decimal2Amount(5000, 6),
            amount0Min: '0',
            amount1Min: '0',
            recipient: tester.address,
            deadline: '0xffffffff',
        });
        await veiZi.connect(miner).stake('1', decimal2Amount(50000, 18), blockNumber + MAXTIME);
        await veiZi.connect(tester).stake('2', decimal2Amount(20000, 18), blockNumber + MAXTIME);

        await uniPositionManager.connect(miner).setApprovalForAll(mining.address, true);
        await uniPositionManager.connect(tester).setApprovalForAll(mining.address, true);


        await mining.connect(miner).deposit('1');
        await mining.connect(tester).deposit('2');
        await mining.connect(tester).deposit('3');

        leftSqrtPriceX96 = BigNumber('1.0001').pow(-10).times(BigNumber('2').pow(96)).toFixed(0);
        rightSqrtPriceX96 = BigNumber('1.0001').pow(10).times(BigNumber('2').pow(96)).toFixed(0);

    });


    it("check modify provider", async function () {

        const deployer = signer;
        
        const {reward: reward1, ok: ok1} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok1).to.equal(true);
        for (const key in rewardPerBlockMap) {
            expect(reward1[key] !== '0').to.equal(true);
        }

        expect((await mining.rewardInfos(0)).provider.toLowerCase()).to.equal(provider.address.toLowerCase());
        expect((await mining.rewardInfos(1)).provider.toLowerCase()).to.equal(provider.address.toLowerCase());

        // non deployer cannot modify provider
        let modifyOk = await modifyProvider(mining, 0, receiver, provider2.address);
        expect(modifyOk).to.equal(false);
        modifyOk = await modifyProvider(mining, 1, receiver, provider2.address);
        expect(modifyOk).to.equal(false);
        modifyOk = await modifyProvider(mining, 2, receiver, provider2.address);
        expect(modifyOk).to.equal(false);
        // cannot modify out of reward range
        modifyOk = await modifyProvider(mining, 2, deployer, provider2.address);
        expect(modifyOk).to.equal(false);

        expect((await mining.rewardInfos(0)).provider.toLowerCase()).to.equal(provider.address.toLowerCase());
        expect((await mining.rewardInfos(1)).provider.toLowerCase()).to.equal(provider.address.toLowerCase());

        const {reward: reward2, ok: ok2} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok2).to.equal(true);
        for (const key in rewardPerBlockMap) {
            expect(reward2[key] !== '0').to.equal(true);
        }

        // modify to provider2
        modifyOk = await modifyProvider(mining, 1, deployer, provider2.address);
        expect(modifyOk).to.equal(true);

        expect((await mining.rewardInfos(0)).provider.toLowerCase()).to.equal(provider.address.toLowerCase());
        expect((await mining.rewardInfos(1)).provider.toLowerCase()).to.equal(provider2.address.toLowerCase());

        // provider2 hasno BIT and not approve, collect reward fail
        const {reward: reward3, ok: ok3} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok3).to.equal(false);
        for (const key in rewardPerBlockMap) {
            expect(reward3[key]).to.equal('0');
        }

        //  provider2 has BIT and appove
        await BIT.mint(provider2.address, hugeAmount);
        await BIT.connect(provider2).approve(mining.address, hugeAmount);
        // collect success
        const {reward: reward4, ok: ok4} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok4).to.equal(true);
        for (const key in rewardPerBlockMap) {
            expect(reward4[key] !== '0').to.equal(true);
        }

        modifyOk = await modifyProvider(mining, 0, deployer, provider2.address);
        expect(modifyOk).to.equal(true);
        expect((await mining.rewardInfos(0)).provider.toLowerCase()).to.equal(provider2.address.toLowerCase());
        expect((await mining.rewardInfos(1)).provider.toLowerCase()).to.equal(provider2.address.toLowerCase());
        // provider2 has no iZi and not approve, collect reward fail
        const {reward: reward5, ok: ok5} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok5).to.equal(false);
        for (const key in rewardPerBlockMap) {
            expect(reward5[key]).to.equal('0');
        }

        //  provider2 has iZi and appove
        await iZi.mint(provider2.address, hugeAmount);
        await iZi.connect(provider2).approve(mining.address, hugeAmount);
        // collect success
        const {reward: reward6, ok: ok6} = await getCollectReward({'iZi': iZi, 'BIT': BIT}, mining, tester);
        expect(ok6).to.equal(true);
        for (const key in rewardPerBlockMap) {
            expect(reward6[key] !== '0').to.equal(true);
        }

        expect((await mining.rewardInfos(0)).provider.toLowerCase()).to.equal(provider2.address.toLowerCase());
        expect((await mining.rewardInfos(1)).provider.toLowerCase()).to.equal(provider2.address.toLowerCase());
    });



});