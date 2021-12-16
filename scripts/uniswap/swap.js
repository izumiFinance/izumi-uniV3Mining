const hardhat = require("hardhat");
const { modules } = require("web3");
const contracts = require("../deployed.js");

const BigNumber = require('bignumber.js');
const { ethereum } = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

const swapRouterJson = require(contracts.swapRouterJson);
const swapRouterAddress = contracts.swapRouter;

const poolJson = require(contracts.poolJson);

const v = process.argv
const net = process.env.HARDHAT_NETWORK

//Example: HARDHAT_NETWORK='izumiTest' node swap.js iZi WETH9 3000 0.00013 1.5

const para = {
    token0Symbol: v[2],
    token0Address: contracts[net][v[2]],
    token1Symbol: v[3],
    token1Address: contracts[net][v[3]],
    fee: v[4],
    destPrice0By1Decimal: BigNumber(v[5]),
    amountInputLimitDecimal: v[6],
}

const weth = contracts[net].WETH9;

async function attachToken(address) {
  var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
  var token = tokenFactory.attach(address);
  return token;
}

async function getDecimal(token) {
  var decimal = await token.decimals();
  return decimal;
}

async function getNumNoDecimal(tokenAddr, num) {
  var token = await attachToken(tokenAddr);
  var decimal = await getDecimal(token);
  var numNoDecimal = BigNumber(num).times(10 ** decimal);
  return numNoDecimal.toFixed(0);
}

async function priceNoDecimal(tokenAddr0, tokenAddr1, priceDecimal0By1) {
  var token0 = await attachToken(tokenAddr0);
  var token1 = await attachToken(tokenAddr1);

  var decimal0 = await getDecimal(token0);
  var decimal1 = await getDecimal(token1);

  var priceNoDecimal0By1 = priceDecimal0By1.times(10 ** decimal1).div(10 ** decimal0);
  return priceNoDecimal0By1;
}

async function movePriceDown(uniSwapRouter, trader, tokenXAddr, tokenYAddr, destSqrtPriceX96, amountInputLimit) {

  if (tokenXAddr != weth) {
    await uniSwapRouter.connect(trader).exactInputSingle({
      tokenIn: tokenXAddr,
      tokenOut: tokenYAddr,
      fee: 3000,
      recipient: trader.address,
      deadline: '0xffffffff',
      amountIn: amountInputLimit,
      amountOutMinimum: '1',
      sqrtPriceLimitX96: destSqrtPriceX96,
    });
  } else {

    console.log('amount input limit: ', amountInputLimit);
    console.log('dest sqrt price: ', destSqrtPriceX96);
    var tx0 = await uniSwapRouter.connect(trader).exactInputSingle({
      tokenIn: tokenXAddr,
      tokenOut: tokenYAddr,
      fee: 3000,
      recipient: trader.address,
      deadline: '0xffffffff',
      amountIn: amountInputLimit,
      amountOutMinimum: '1',
      sqrtPriceLimitX96: destSqrtPriceX96,
    },{value: amountInputLimit});

    var tx1 = await uniSwapRouter.connect(trader).unwrapWETH9('0', trader.address);
    console.log('tx0: ', tx0);
    console.log('tx1: ', tx1);
  }

}

async function movePriceUp(uniSwapRouter, trader, tokenXAddr, tokenYAddr, destSqrtPriceX96, amountInputLimit) {

  if (tokenYAddr != weth) {
    await uniSwapRouter.connect(trader).exactInputSingle({
        tokenIn: tokenYAddr,
        tokenOut: tokenXAddr,
        fee: 3000,
        recipient: trader.address,
        deadline: '0xffffffff',
        amountIn: amountInputLimit,
        amountOutMinimum: '1',
        sqrtPriceLimitX96: destSqrtPriceX96,
    });
  } else {

    console.log('amount input limit: ', amountInputLimit);

    var tx0 = await uniSwapRouter.connect(trader).exactInputSingle({
      tokenIn: tokenYAddr,
      tokenOut: tokenXAddr,
      fee: 3000,
      recipient: trader.address,
      deadline: '0xffffffff',
      amountIn: amountInputLimit,
      amountOutMinimum: '1',
      sqrtPriceLimitX96: destSqrtPriceX96,
    },{value: amountInputLimit});

    var tx1 = await uniSwapRouter.connect(trader).unwrapWETH9('0', trader.address);
    console.log('tx0: ', tx0);
    console.log('tx1: ', tx1);
  }

}

async function approve(token, account, destAddr, amount) {
  await token.connect(account).approve(destAddr, amount);
}

async function main() {

  if (para.token0Address.toLowerCase() > para.token1Address.toLowerCase()) {

      var tmp = para.token0Address;
      para.token0Address = para.token1Address;
      para.token1Address = tmp;

      tmp = para.token0Symbol;
      para.token0Symbol = para.token1Symbol;
      para.token1Symbol = tmp;

      para.destPrice0By1Decimal = BigNumber(1).div(para.destPrice0By1Decimal);
  }

  const destPrice0By1NoDecimal = await priceNoDecimal(para.token0Address, para.token1Address, para.destPrice0By1Decimal);

  const destSqrtPrice0By1NoDecimal = destPrice0By1NoDecimal.sqrt();
  const destSqrtPriceX96 = destSqrtPrice0By1NoDecimal.times(BigNumber(2).pow(96)).toFixed(0);


  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  console.log("    destPrice0By1Decimal: ", para.destPrice0By1Decimal.toFixed(10));
  console.log("    destPrice0By1NoDecimal: ", destPrice0By1NoDecimal.toFixed(10));
  console.log("    destSqrtPrice0By1NoDecimal: ", destSqrtPrice0By1NoDecimal.toFixed(10));
  console.log("    destSqrtPriceX96: ", destSqrtPriceX96);

  const [deployer, tester] = await hardhat.ethers.getSigners();

  const factoryContract = await hardhat.ethers.getContractFactory(factoryJson.abi, factoryJson.bytecode, deployer);
  const factory = factoryContract.attach(factoryAddress);
  
  //get the info of pool
  let poolAddr = await factory.getPool(para.token0Address, para.token1Address, para.fee);
  console.log('Pool: ', poolAddr);

  const poolContract = await hardhat.ethers.getContractFactory(poolJson.abi, poolJson.bytecode, deployer);
  const pool = poolContract.attach(poolAddr);

  const swapRouterContract = await hardhat.ethers.getContractFactory(swapRouterJson.abi, swapRouterJson.bytecode, deployer);
  const swapRouter = swapRouterContract.attach(swapRouterAddress);

  /*
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // the most-recently updated index of the observations array
        uint16 observationIndex;
        // the current maximum number of observations that are being stored
        uint16 observationCardinality;
        // the next maximum number of observations to store, triggered in observations.write
        uint16 observationCardinalityNext;
  */
  let currentSqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext;
  [currentSqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext] = await pool.slot0();
  console.log('tick: ', tick);
  console.log('oobservationIndex: ', observationIndex);
  console.log('observationCardinality: ', observationCardinality);
  console.log('observationCardinalityNext: ', observationCardinalityNext);

  currentSqrtPriceX96 = currentSqrtPriceX96.toString();

  console.log('currentsqrtpricex96: ', currentSqrtPriceX96);

  await approve(await attachToken(para.token0Address), tester, swapRouterAddress, "1000000000000000000000000000000");
  await approve(await attachToken(para.token1Address), tester, swapRouterAddress, "1000000000000000000000000000000");

  if (BigNumber(destSqrtPriceX96).gt(currentSqrtPriceX96)) {
    const amountInputLimit = await getNumNoDecimal(para.token0Address, para.amountInputLimitDecimal);
    await movePriceUp(swapRouter, tester, para.token0Address, para.token1Address, destSqrtPriceX96, amountInputLimit);
  } else {
    const amountInputLimit = await getNumNoDecimal(para.token1Address, para.amountInputLimitDecimal);
    await movePriceDown(swapRouter, tester, para.token0Address, para.token1Address, destSqrtPriceX96, amountInputLimit);
  }
  
}

main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})

module.exports = main;
