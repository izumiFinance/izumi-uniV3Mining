const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');
// example
// HARDHAT_NETWORK='izumiTest' \
//     node mintDynRange.js \
//     'DYNRANGE_WETH9_IZI_3000' 
//     100
//     1000
//     1000
//
const v = process.argv
const net = process.env.HARDHAT_NETWORK

const weth = contracts[net].WETH9


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    amount0Decimal: v[3],
    amount1Decimal: v[4],
    amountIZiDecimal: v[5],
    amount0NoDecimal: 0,
    amount1NoDecimal: 0,
    amountIZiNoDecimal: 0,
}

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

async function getBalance(tokenAddrList, userAddr) {
    let balanceList = [];
    for (var i = 0; i < tokenAddrList.length; i ++) {
        const tokenAddr = tokenAddrList[i];
        if (tokenAddr.toUpperCase() == weth.toUpperCase()) {
            const ethAmountNoDecimal = await hardhat.ethers.provider.getBalance(userAddr);
            const ethAmountDecimal = BigNumber(ethAmountNoDecimal._hex).div(10**18);
            balanceList.push(ethAmountDecimal);
        } else {
            var token = await attachToken(tokenAddrList[i]);
            const balanceNoDecimal = await token.balanceOf(userAddr);
            const decimal = await getDecimal(token);
            const balanceDecimal = BigNumber(balanceNoDecimal._hex).div(10**decimal);
            balanceList.push(balanceDecimal);
        }
    }
    return balanceList;
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningDynamicRangeBoost");
  const mining = await Mining.attach(para.miningPoolAddr);


  const tokenContract = await hardhat.ethers.getContractFactory("TestToken");

  const [token0Addr, token1Addr] =  await mining.getMiningContractInfo();
  console.log(token0Addr);
  console.log(token1Addr);
  const tokenIZiAddr = contracts[net]['iZi'];
  para.amount0NoDecimal = await getNumNoDecimal(token0Addr, para.amount0Decimal);
  para.amount1NoDecimal = await getNumNoDecimal(token1Addr, para.amount1Decimal);
  para.amountIZiNoDecimal = await getNumNoDecimal(tokenIZiAddr, para.amountIZiDecimal);

  let ethAmountNoDecimal = 0;
  if (token0Addr.toUpperCase() == contracts[net].WETH9.toUpperCase()) {
      ethAmountNoDecimal = para.amount0NoDecimal;
  }
  if (token1Addr.toUpperCase() == contracts[net].WETH9.toUpperCase()) {
      ethAmountNoDecimal = para.amount1NoDecimal;
  }
  console.log("Paramters: ");
  for ( var i in para) { console.log("    " + i + ": " + para[i]); }
  console.log("    eth amount no decimal: ", ethAmountNoDecimal);
  
  const token0 = tokenContract.attach(token0Addr);
  await token0.connect(tester).approve(mining.address, "1000000000000000000000000000000");

  const token1 = tokenContract.attach(token1Addr);
  await token1.connect(tester).approve(mining.address, "1000000000000000000000000000000");

  const tokenIZI = tokenContract.attach(contracts[net]['iZi']);
  await tokenIZI.connect(tester).approve(mining.address, "1000000000000000000000000000000");

  const tokenAddrList = [token0Addr, token1Addr, tokenIZiAddr];

  const balanceBefore = await getBalance(tokenAddrList, tester.address);

  const tx = await mining.connect(tester).depositWithuniToken(para.amount0NoDecimal, para.amount1NoDecimal, para.amountIZiNoDecimal, {value: ethAmountNoDecimal});

  const balanceAfter = await getBalance(tokenAddrList, tester.address);

  const balanceDelta = balanceBefore.map((v, i)=>{
      return balanceAfter[i].minus(v);
  })
  const balanceDeltaStr = balanceDelta.map((v)=>{ return v.toFixed(10); });

  console.log("tx: ", tx);

  console.log('balance delta: ', balanceDeltaStr);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
