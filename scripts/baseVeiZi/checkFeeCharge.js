const hardhat = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkReceiveFeeCharged.js \
//     'DYNRANGE_WETH9_DDAO_3000' 

const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: v[2],
}

async function attachToken(address) {
    var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
    var token = tokenFactory.attach(address);
    return token;
  }
  
async function getBalance(user, tokens) {
    balance = [];
    for (var tokenAddr of tokens) {
        console.log('token addr: ', tokenAddr);

        if (BigNumber(tokenAddr).eq('0')) {
          balance.push({_hex:'0x0'});
        } else if (tokenAddr === contracts[net].WETH9) {
            var b = await hardhat.ethers.provider.getBalance(user.address);
            balance.push(b);
        } else {
          var token = await attachToken(tokenAddr);
          var b = await token.balanceOf(user.address);
          balance.push(b);
        }
    }
    balance = balance.map((b)=>BigNumber(b._hex));
    return balance;
}

async function main() {
    
  let [deployer, tester, receiver] = await hardhat.ethers.getSigners();


  console.log('recevier:' ,receiver.address);


  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostVeiZi");
  const mining = Mining.attach(para.miningPoolAddr);

  console.log('charge receiver: ', (await mining.chargeReceiver()));
  
  const poolInfo = await mining.rewardPool();
  console.log('pool info: ', poolInfo);
  const token0 = poolInfo['token0'];
  const token1 = poolInfo['token1'];

  console.log('token0: ', token0);
  console.log('token1: ', token1);

  console.log('origin totalFeeCharged0: ', (await mining.totalFeeCharged0()).toString());
  console.log('origin totalFeeCharged1: ', (await mining.totalFeeCharged1()).toString());

  const originBalance = await getBalance(receiver, [token0, token1]);

  tx = await mining.connect(receiver).collectFeeCharged();
  console.log('tx: ', tx);

  const afterBalance = await getBalance(receiver, [token0, token1]);
  const delta = [];
  for(var i = 0; i < originBalance.length; i ++) {
      delta.push(afterBalance[i].minus(originBalance[i]).toFixed(0));
  }
  console.log('delta: ', delta);


  console.log('current totalFeeCharged0: ', (await mining.totalFeeCharged0()).toString());
  console.log('current totalFeeCharged1: ', (await mining.totalFeeCharged1()).toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
