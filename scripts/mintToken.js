const hardhat = require("hardhat");
const contracts = require("./deployed.js");
const BigNumber = require('bignumber.js');

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node mintToken.js 'BIT' 10 '0xD4D6F030520649c7375c492D37ceb56571f768D0'

const para = {
    symbol: v[2],
    amountDecimal: v[3],
    address: v[4],
}
async function attachToken(address) {
    var contractFactory = await hardhat.ethers.getContractFactory("TestToken");
    var contract = contractFactory.attach(address);
    return contract;
}

async function getDecimal(token) {
    var decimal = await token.decimals();
    return decimal;
}
async function getNumNoDecimal(tokenAddr, num) {
    var token = await attachToken(tokenAddr);
    var decimal = await getDecimal(token);
    console.log('decimal: ', decimal);
    console.log('num: ', num);
    var numNoDecimal = BigNumber(num).times(10 ** decimal);
    console.log('numNoDecimal: ', numNoDecimal.toFixed(0));
    return numNoDecimal.toFixed(0);
}
async function main() {
    const tokenAddr = contracts[net][para.symbol];
    const token = await attachToken(tokenAddr);
    const amountNoDecimal = getNumNoDecimal(tokenAddr, para.amountDecimal);
    await token.mint(para.address, amountNoDecimal);
    const balance = await token.balanceOf(para.address);
    
    console.log('balance: ', balance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
