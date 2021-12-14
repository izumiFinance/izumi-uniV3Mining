const hardhat = require("hardhat");
const contracts = require("./deployed.js");

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node viewBalance 'BIT' '0xB96C85b716086a2410e874A1A6C8bDd4f35F2850'

const para = {
    symbol: v[2],
    address: v[3],
}
async function attachToken(address) {
    var contractFactory = await hardhat.ethers.getContractFactory("TestToken");
    var contract = contractFactory.attach(address);
    return contract;
}

async function main() {
    if (para.symbol == 'ETH') {
        const provider = hardhat.waffle.provider;
        const balance0ETH = await provider.getBalance(para.address);
        console.log('balance: ', balance0ETH.toString());
    } else {
        const tokenAddr = contracts[net][para.symbol];
        const token = await attachToken(tokenAddr);
        const balance = await token.balanceOf(para.address);
        console.log('balance: ', balance.toString());
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
