const { ethers } = require("hardhat");
const deployed = require('../deployed.js');

const { getFixRange } = require('../libraries/getFixRange');

const uniswap = require('../libraries/uniswap');

/*

example: 

HARDHAT_NETWORK='ethereum' node scripts/fixRange/nftStatistics.js FIXRANGE_USDC_USDT_100 output/data.txt

*/

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const para = {
  fixRangeSymbol : v[2],
  fixRangeAddress : deployed[net][v[2]],
  path: v[3]
}

async function main() {
    const fixRangeContract = getFixRange(para.fixRangeAddress);
    const nftManager = uniswap.getNftManager(deployed[net].nftManager);
    const nftIds = await uniswap.getNfts(nftManager, para.fixRangeAddress);
    let list = []
    for (const nft of nftIds) {
        const tokenStatus = await fixRangeContract.methods.tokenStatus(nft).call();
        const owner = await fixRangeContract.methods.owners(nft).call();
        list.push([owner, tokenStatus.vLiquidity]);
    }
    let data = '';
    for (const item of list) {
        const line = item[0] + ' ' + item[1];
        data = data + line + '\n';
    }
    const fs = require('fs');
    await fs.writeFileSync(para.path, data);
}

main().then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
})