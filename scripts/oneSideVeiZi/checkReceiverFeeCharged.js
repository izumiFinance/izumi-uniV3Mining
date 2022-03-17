const {ethers} = require("hardhat");
const contracts = require("../deployed.js");
const BigNumber = require('bignumber.js');

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkReceiveFeeCharged.js \
//     'FIXRANGE_V2_USDC_USDT_100' 

const v = process.argv
const net = process.env.HARDHAT_NETWORK

const weth = contracts[net].WETH9

function getAddress(symbolOrAddress) {
  const prefix = symbolOrAddress.slice(0, 2);
  if (prefix.toLowerCase() === '0x') {
    return symbolOrAddress;
  }
  return contracts[net][symbolOrAddress];
}
const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: getAddress(v[2]),
}

async function attachToken(address) {
    var tokenFactory = await ethers.getContractFactory("TestToken");
    var token = tokenFactory.attach(address);
    return token;
  }
async function getBalance(user, tokens) {
  balance = [];
  for (var tokenAddr of tokens) {
      console.log('token addr: ', tokenAddr);

      if (BigNumber(tokenAddr).eq('0')) {
        balance.push({_hex:'0x0'});
      } else if (tokenAddr.toLowerCase() != weth.toLowerCase()) {
        var token = await attachToken(tokenAddr);
        var b = await token.balanceOf(user.address);
        balance.push(b);
      } else {
        var b = await ethers.provider.getBalance(user.address);
        balance.push(b);
      }
  }
  balance = balance.map((b)=>BigNumber(b._hex));
  return balance;
}

async function getMeta(mining) {
    const meta = await mining.getMiningContractInfo();
    return {
        uniToken: meta.uniToken_,
        lockToken: meta.lockToken_,
        fee: meta.fee_,
        lockBoostMultiplier: Number(meta.lockBoostMultiplier_.toString()),
        veiZiAddress: meta.veiZiAddress_,
        totalVLiquidity: meta.totalVLiquidity_.toString(),
        totalLock: meta.totalLock_.toString(),
        totalValidVeiZi: meta.totalValidVeiZi_.toString(),
    }
  }

async function getBalance(user, tokens) {
    balance = [];
    for (var tokenAddr of tokens) {
        console.log('token addr: ', tokenAddr);

        if (BigNumber(tokenAddr).eq('0')) {
          balance.push({_hex:'0x0'});
        } else if (tokenAddr != weth) {
          var token = await attachToken(tokenAddr);
          var b = await token.balanceOf(user.address);
          balance.push(b);
        } else {
          var b = await ethers.provider.getBalance(user.address);
          balance.push(b);
        }
    }
    balance = balance.map((b)=>BigNumber(b._hex));
    return balance;
}

function bigNumberListToStr(b) {
    c = b.map((a)=>a.toFixed(0));
    return c;
}

async function main() {
    
  const [deployer, tester, receiver] = await ethers.getSigners();

  console.log('recevier:' ,receiver.address);

  const Mining = await ethers.getContractFactory("MiningOneSideBoostVeiZi");
  const mining = Mining.attach(para.miningPoolAddr);
  const meta = await getMeta(mining);

  var totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
  var totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();

  console.log('totalFeeCharged0: ', totalFeeCharged0);
  console.log('totalFeeCharged1: ', totalFeeCharged1);

  var collectTokens = [meta.uniToken, meta.lockToken];

  var originBalances = await getBalance(receiver, collectTokens);
  try {
  var tx = await mining.connect(receiver).collectFeeCharged();
  console.log('tx: ', tx);
  } catch(err) {
      console.log(err);
  }

  var currBalance = await getBalance(receiver, collectTokens);
  console.log('curr balance: ', currBalance);
  for (var i = 0; i < currBalance.length; i ++) {
      currBalance[i]=currBalance[i].minus(originBalances[i]);
  }
  console.log('delta: ', currBalance);
  console.log('delta: ', bigNumberListToStr(currBalance));

  totalFeeCharged0 = (await mining.totalFeeCharged0()).toString();
  totalFeeCharged1 = (await mining.totalFeeCharged1()).toString();

  console.log('after totalFeeCharged0: ', totalFeeCharged0);
  console.log('after totalFeeCharged1: ', totalFeeCharged1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
