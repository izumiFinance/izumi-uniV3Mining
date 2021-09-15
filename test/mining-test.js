// test for mining contract
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployUniV3 } = require("../scripts/deploy-uniV3.js");
const { deployToken } = require("../scripts/deploy-token.js");

describe("Mining Contract Test", function () {
    // uniV3 related contracts are in uniV3
    // weth9, factory, router, nftDescriptorLibrary, positionDescriptor, positionManager
    let uniV3;

    // erc20 token contracts
    let usdt;
    let usdc;
    let dai;

    let poolAddress;
    
    // `beforeEach` will run before each test, re-deploying the contract every
    // time. It receives a callback, which can be async.
    beforeEach(async function () {
        const [deployer] = await hre.ethers.getSigners();
        const usdtOwned = '10000000000000000000000';
        const usdcOwned = '10000000000000000000000';
        const daiOwned = '10000000000000000000000';
        const rewardTokenOwned = '10000000000000000000000';

        // deploy prepared contracts
        uniV3 = await deployUniV3();
        usdt = await deployToken("USDT Coin", "USDT", usdtOwned);
        usdc = await deployToken("USDC Coin", "USDC", usdcOwned);
        dai = await deployToken("DAI Coin", "DAI", daiOwned);
        rewardToken = await deployToken("Reward Coin", "RWD", rewardTokenOwned);

        // create USDT/USDC/500 pool for test
        console.log("Create Pool Contract: USDT/USDC/500");
        await uniV3.positionManager.createAndInitializePoolIfNecessary(usdt.address, usdc.address, 500, '79228162514264337593543950336');
        poolAddress = await uniV3.factory.getPool(usdt.address, usdc.address, 500);
        console.log("pool address: ", poolAddress);

        // mint NFT for test
        await usdt.approve(uniV3.positionManager.address, '10000000000000000000000');
        await usdc.approve(uniV3.positionManager.address, '10000000000000000000000');
        expect(await usdt.allowance(deployer.address, uniV3.positionManager.address)).to.equal('10000000000000000000000');
        expect(await usdc.allowance(deployer.address, uniV3.positionManager.address)).to.equal('10000000000000000000000');
        
        const parameter = {
          token0: usdt.address,
          token1: usdc.address,
          fee: 500,
          tickLower: -10, 
          tickUpper: 10,
          amount0Desired: '10000000000000000000000', 
          amount1Desired: '10000000000000000000000', 
          amount0Min: 0, 
          amount1Min: 0, 
          recipient: deployer.address,
          deadline: '10000000000000000000'
        };
        console.log(parameter);
        await uniV3.positionManager.mint(parameter);
    });
    
    it("deposit function Test", async function () {

    });
});
