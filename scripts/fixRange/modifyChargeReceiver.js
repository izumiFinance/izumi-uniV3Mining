const hardhat = require("hardhat");
const contracts = require("../deployed.js");

// example
// HARDHAT_NETWORK='izumiTest' \
//     node modifyChargeReceiver.js \
//     'FIXRANGE_V2_USDC_USDT_100' 
//     0x7576BCf2700A86e8785Cfb1f9c2FF402941C9789
//     0
const v = process.argv
const net = process.env.HARDHAT_NETWORK


const para = {
    miningPoolSymbol: v[2],
    miningPoolAddr: contracts[net][v[2]],
    chargeReceiver: v[3],
    owner: Number(v[4]),
}

async function main() {
    
  const [deployer, tester] = await hardhat.ethers.getSigners();

  const Mining = await hardhat.ethers.getContractFactory("MiningFixRangeBoostV2");
  const mining = Mining.attach(para.miningPoolAddr);
  var tx;
  if (para.owner === 1) {

    tx = await mining.modifyChargeReceiver(para.chargeReceiver);
  } else {

    tx = await mining.connect(tester).modifyChargeReceiver(para.chargeReceiver);
  }
  console.log('tx: ', tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
