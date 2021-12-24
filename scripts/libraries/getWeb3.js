const Web3 = require("web3");
const config = require("../../hardhat.config.js");

function getWeb3() {
    const net = process.env.HARDHAT_NETWORK
    const rpc = config.networks[net].url
    const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
    return web3;
}

module.exports ={ getWeb3 };
