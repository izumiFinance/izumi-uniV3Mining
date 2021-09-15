const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Mining", function () {
    // `beforeEach` will run before each test, re-deploying the contract every
    // time. It receives a callback, which can be async.
    beforeEach(async function () {
        // Get the ContractFactory and Signers here.
        Token = await ethers.getContractFactory("Token");
        [Alice, Bob, ...addrs] = await ethers.getSigners();

        // To deploy our contract, we just have to call Token.deploy() and await
        // for it to be deployed(), which happens onces its transaction has been
        // mined.
        hardhatToken = await Token.deploy();
    });
    
    it("Token Test", async function () {
        const Token = await ethers.getContractFactory("Token");
        const dai = await Token.attach('0x894DDffd276947d68090C9CaCDa26fd4b85f50a4');
        expect(await dai.name()).to.equal('Dai Stable Coin');
        expect(await dai.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0')).to.equal(1000000000);
    });
});
