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

HARDHAT_NETWORK='ethereum' node scripts/fixRange/nftStatistics.js FIXRANGE_USDC_USDT_100 output/data.txt

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

const sqrtRatioMap = {}

function getSqrtRatio(n) {
  if (sqrtRatioMap[n] != undefined) {
    return sqrtRatioMap[n];
  }
  sqrtRatioMap[n] = BigNumber(1.0001 ** n).sqrt();
  return sqrtRatioMap[n];
}

function _getAmount0(liquidity, sqrtRatioA, sqrtRatioB) {
  if (sqrtRatioA.gte(sqrtRatioB)) {
    return BigNumber(0);
  }
  return liquidity.times(sqrtRatioB.minus(sqrtRatioA)).div(sqrtRatioA).div(sqrtRatioB);
}

function _getAmount1(liquidity, sqrtRatioA, sqrtRatioB) {
  if (sqrtRatioA.gte(sqrtRatioB)) {
    return BigNumber(0);
  }
  return liquidity.times(sqrtRatioB.minus(sqrtRatioA));
}

function getAmount(liquidity, tickLower, tickUpper, sqrtPrice) {
  const sqrtRatioLower = getSqrtRatio(tickLower);
  const sqrtRatioUpper = getSqrtRatio(tickUpper);

  let amount0 = BigNumber(0);
  let amount1 = BigNumber(0);
  let liquidityBN = BigNumber(liquidity);

  if (sqrtRatioUpper.gt(sqrtPrice)) {
    amount0 = _getAmount0(liquidityBN, sqrtRatioLower, sqrtPrice);
  } else {
    amount0 = _getAmount0(liquidityBN, sqrtRatioLower, sqrtRatioUpper);
  }

  if (sqrtRatioLower.gt(sqrtPrice)) {
    amount1 = _getAmount1(liquidityBN, sqrtRatioLower, sqrtRatioUpper);
  } else {
    amount1 = _getAmount1(liquidityBN, sqrtPrice, sqrtRatioUpper);
  }

  return [amount0, amount1];
}

async function main() {
    const fixRangeContract = getFixRange(para.fixRangeAddress);
    const miningContractInfo = await fixRangeContract.methods.getMiningContractInfo().call();
    const rewardLowerTick = Number(miningContractInfo.rewardLowerTick_);
    const rewardUpperTick = Number(miningContractInfo.rewardUpperTick_);
    console.log('lower tick: ', rewardLowerTick);
    console.log('upper tick: ', rewardUpperTick);
    
    const poolInfo = await fixRangeContract.methods.rewardPool().call();
    console.log('poolInfo: ', poolInfo);
    const token0 = getToken(poolInfo.token0);
    const token1 = getToken(poolInfo.token1);
    
    const token0Decimal = Number(await token0.methods.decimals().call());
    const token1Decimal = Number(await token1.methods.decimals().call());
    console.log('token0 decimal: ', token0Decimal);
    console.log('token1 decimal: ', token1Decimal);
    
    const nftManager = uniswap.getNftManager(deployed[net].nftManager);
    let nftIds = await uniswap.getNfts(nftManager, para.fixRangeAddress);

    console.log('ids: ', nftIds);

    const web3 = getWeb3();
    
    const nftDetails = await uniswap.getNftDetails(web3, nftManager, nftIds);
    console.log('nftDetails: ', nftDetails.length);
    const owners = await getOwners(web3, fixRangeContract, nftIds);
    console.log('owners: ', owners.length);

    const factory = uniswap.getFactory(deployed[net].factory);
    const poolAddress = await uniswap.getPoolAddressFromPair(factory, poolInfo.token0, poolInfo.token1, poolInfo.fee);
    console.log('pool address: ', poolAddress);
    const pool = uniswap.getPool(poolAddress);

    const slot0 = await pool.methods.slot0().call();
    console.log('slot0: ', slot0);
    const sqrtPrice = BigNumber(slot0.sqrtPriceX96).div(BigNumber(2).pow(96));
    console.log('sqrtPrice:' , sqrtPrice.toFixed(10));
    
    let list = []
    for (let i = 0; i < nftIds.length; i ++) {
      console.log(i);
      const owner = owners[i];
      const nftId = nftIds[i];
      const tickLower = Math.max(rewardLowerTick, Number(nftDetails[i].tickLower));
      const tickUpper = Math.min(rewardUpperTick, Number(nftDetails[i].tickUpper));
      console.log(tickLower, tickUpper);
      console.log(Number(nftDetails[i].tickLower), Number(nftDetails[i].tickUpper));
      const [amount0, amount1] = getAmount(nftDetails[i].liquidity, tickLower, tickUpper, sqrtPrice);
      console.log('liquidity: ', nftDetails[i].liquidity);
      const [totalAmount0, totalAmount1] = getAmount(nftDetails[i].liquidity, Number(nftDetails[i].tickLower), Number(nftDetails[i].tickUpper), sqrtPrice);
      const amount0Decimal = amount0.div(10**token0Decimal).toFixed(10);
      const amount1Decimal = amount1.div(10**token1Decimal).toFixed(10);

      const totalAmount0Decimal = totalAmount0.div(10 ** token0Decimal).toFixed(10);
      const totalAmount1Decimal = totalAmount1.div(10 ** token1Decimal).toFixed(10);
      // console.log(amount0.toFixed(10), amount0Decimal, amount1.toFixed(10), amount1Decimal);
      // console.log(nftId, nftDetails[i].liquidity, nftDetails[i].tickLower, nftDetails[i].tickUpper);
      // console.log('--------------------')
      // list.push([owner, nftId, ])
      list.push([owner, amount0Decimal, amount1Decimal, totalAmount0Decimal, totalAmount1Decimal]);
    }
    
    let data = '';
    for (const item of list) {
      data = data + String(item[0]) + ' ' + String(item[1]) + ' ' + String(item[2]) + ' ' + String(item[3]) + ' ' + String(item[4]) + '\n';
    }
    
    const fs = require('fs');
    await fs.writeFileSync(para.path, data);
}

main().then(() => process.exit(0))
.catch((error) => {
  console.error(error);
  process.exit(1);
})