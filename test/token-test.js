const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Token", function () {
  it("Token Test", async function () {
    const Token = await ethers.getContractFactory("Token");
    const dai = await Token.attach('0x894DDffd276947d68090C9CaCDa26fd4b85f50a4');
    expect(await dai.name()).to.equal('Dai Stable Coin');
    expect(await dai.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0')).to.equal(1000000000);
  });
});
