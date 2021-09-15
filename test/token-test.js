const { expect } = require("chai");
const { ethers } = require("hardhat");
const { deployToken } = require("../scripts/deploy-token.js");

describe("Token Test", function () {
  // erc20 token contracts
  let usdt;
  let usdc;
  let dai;

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
      usdt = await deployToken("USDT Coin", "USDT", "1000000000000");
      usdc = await deployToken("USDC Coin", "USDC", "1000000000000");
      dai  = await deployToken("DAI Coin", "DAI", "1000000000000");
  });
  
  // test the parameters of constructor
  it("Deploy Test", async function () {
    const [signer] = await hre.ethers.getSigners();
    console.log(signer.address);
    const balance = await usdt.balanceOf(signer.address);
    console.log('balance: ', balance.toNumber());
    expect(balance.toNumber() < 0);

    // expect(await usdt.name()).to.equal('USDT Coin');
    // expect(await usdc.name()).to.equal('USDC Coin');
    // expect(await dai.name()).to.equal('DAI Coin');
  });
  
  // test transfer function of 
  // it("Transfer Test", async function () {
  //   const [signer] = await hre.ethers.getSigners();
  //   await dai.transfer('0xD4D6F030520649c7375c492D37ceb56571f768D0', 1000);
  //   expect(await dai.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0')).to.equal(1000);
  //   expect(await usdt.balanceOf(signer.address) == 1000000000000 - 1000);
  //   console.log(await usdt.balanceOf(signer.address));
  // });
});
