
const { ethers, waffle} = require("hardhat");const hre = require("hardhat");

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node viewETH '0x6A794Ac1AD9401cb988f00F4ad2629F09B28d172'

const para = {
    address: v[2],
}


//mint uniswap v3 nft
async function main() {
  for (var i in para) { console.log("    " + i + ": " + para[i]);}
  const provider = waffle.provider;
  const balance0ETH = await provider.getBalance(para.address);
  console.log('balance: ', balance0ETH.toString());

}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
