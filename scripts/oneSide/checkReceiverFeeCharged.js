const hardhat = require("hardhat");
const contracts = require("../deployed.js");

const factoryJson = require(contracts.factoryJson);
const factoryAddress = contracts.factory;

// example
// HARDHAT_NETWORK='izumiTest' \
//     node checkReceiveFeeCharged.js \
//     'FIXRANGE_V2_USDC_USDT_100' 

const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
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

async function main() {
    
  const [deployer, tester, receiver] = await hardhat.ethers.getSigners();

  console.log('recevier:' ,receiver.address);

  const Mining = await hardhat.ethers.getContractFactory("MiningOneSideBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);

  tx = await mining.connect(receiver).collectFeeCharged();
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
