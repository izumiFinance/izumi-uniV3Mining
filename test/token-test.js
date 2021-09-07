const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LPToken", function () {
  it("Should return the new greeting once it's changed", async function () {
    const LPToken = await ethers.getContractFactory("LPToken");
    const token = await LPToken.deploy(10);
    await token.deployed();


    expect(await token.name()).to.equal("Izume");
    expect(await token.symbol()).to.equal("IZM");
  });
});
