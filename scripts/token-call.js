const { ethers } = require("hardhat");
const hre = require("hardhat");
async function main() {

    const Token = await ethers.getContractFactory("Token");
    const weth9 = await Token.attach('0x959a66DF1b53851e9CbdA9C7012cCc211Fb0Dc0A');
    console.log(weth9.totalSupply());
    console.log(weth9.balanceOf('0xD4D6F030520649c7375c492D37ceb56571f768D0'));
}
