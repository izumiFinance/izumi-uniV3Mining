const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployUniV3 } = require("../scripts/deploy-uniV3.js");
const { deployToken } = require("../scripts/deploy-token.js");

describe("Deposit Test", function () {
    // uniV3 related contracts are in uniV3
    // weth9, factory, router, nftDescriptorLibrary, positionDescriptor, positionManager
    let uniV3;

    // erc20 token contracts
    let usdt;
    let usdc;
    let dai;
    
    // `beforeEach` will run before each test, re-deploying the contract every
    // time. It receives a callback, which can be async.
    beforeEach(async function () {
        uniV3 = await deployUniV3();
        usdt = await deployToken("USDT Coin", "USDT", "1000000000000");
        usdc = await deployToken("USDC Coin", "USDT", "1000000000000");
        dai = await deployToken("DAI Coin", "USDT", "1000000000000");
    });
    
    it("Deploy Test", async function () {
        console.log("usdt: ", usdt.address);
    });
});
