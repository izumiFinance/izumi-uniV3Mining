const { ethers } = require("hardhat");
const deployed = require('../deployed.js');

const { getFixRange } = require('../libraries/getFixRange');

const uniswap = require('../libraries/uniswap');

const config = require('../../hardhat.config');
const {getWeb3} = require('../libraries/getWeb3');
const {getToken} = require('../libraries/getToken');
const BigNumber = require('bignumber.js');
const { strictEqual } = require("assert");

/*

example: 

HARDHAT_NETWORK='polygon' node scripts/fixRange/nftiZiBoost.js FIXRANGE_V2_USDC_USDT_500 output/data.txt

*/

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const para = {
  fixRangeSymbol : v[2],
  fixRangeAddress : deployed[net][v[2]],
  path: v[3]
}

async function getOwners(web3, fixRangeContract, nftIds) {
    const nftNum = nftIds.length;
    const ownersResponse = [];
    for (let i = 0; i < nftNum; i += 100) {
        const boundary = Math.min(nftNum, i + 100);
        const multicallData = [];
        for (let j = i; j < boundary; j ++) {
            multicallData.push(fixRangeContract.methods.owners(nftIds[j]).encodeABI());
        }
        const res = await fixRangeContract.methods.multicall(multicallData).call();
        ownersResponse.push(...res);
    }
    owners = [];
    for (let i = 0; i < ownersResponse.length; i ++) {
      const res = ownersResponse[i];
      const decode = web3.eth.abi.decodeParameter('address', res);
      owners.push(decode);
    }
    return owners;
}

async function getiZiBoost(web3, fixRangeContract, nftIds) {
    const nftNum = nftIds.length;
    const tokenStatusResponse = [];
    for (let i = 0; i < nftNum; i += 100) {
        const boundary = Math.min(nftNum, i + 100);
        const multicallData = [];
        for (let j = i; j < boundary; j ++) {
            multicallData.push(fixRangeContract.methods.tokenStatus(nftIds[j]).encodeABI());
        }
        const res = await fixRangeContract.methods.multicall(multicallData).call();
        tokenStatusResponse.push(...res);
    }
    const iZiBoost = [];
    for (let i = 0; i < tokenStatusResponse.length; i ++) {
        const res = tokenStatusResponse[i];
        const decode = web3.eth.abi.decodeParameters(
            [{
                'type': 'uint256',
                'name': 'vLiquidity',
            },{

                'type': 'uint256',
                'name': 'validVLiquidity',
            },{

                'type': 'uint256',
                'name': 'nIZI',
            }], res
        );
        const niZi = decode.nIZI;
        iZiBoost.push(niZi);
    }
    return iZiBoost;
}

async function main() {
    const fixRangeContract = getFixRange(para.fixRangeAddress);
    
    const nftManager = uniswap.getNftManager(deployed[net].nftManager);
    const nftIds = await uniswap.getNfts(nftManager, para.fixRangeAddress);

    console.log('ids: ', nftIds);

    const web3 = getWeb3();
    
    const owners = await getOwners(web3, fixRangeContract, nftIds);
    const iZiBoost = await getiZiBoost(web3, fixRangeContract, nftIds);

    const iZiToken = await getToken(deployed[net].iZi);
    const decimal = await iZiToken.methods.decimals().call();
    console.log('decimal: ', decimal);
    console.log('owners: ', owners.length);
    console.log('iZiBoosts: ', iZiBoost.length);

    let list = []
    for (let i = 0; i < nftIds.length; i ++) {
        const id = nftIds[i];
        const owner = owners[i];
        if (iZiBoost[i] !== '0') {
            const niZi = new BigNumber(iZiBoost[i]).div(10 ** decimal).toFixed(10);
            list.push([id, owner, niZi]);
        }
    }
    
    let data = '';
    for (const item of list) {
      data = data + String(item[0]) + ' ' + String(item[1]) + ' ' + String(item[2]) + '\n';
    }
    
    const fs = require('fs');
    fs.writeFileSync(para.path, data);
}

main().then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
})