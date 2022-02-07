const { getWeb3 } = require('../getWeb3');
const deployed = require('../../deployed.js');
const poolJson = require(deployed.poolJson);

function getPool(address) {
    const web3 = getWeb3();
    const pool = new web3.eth.Contract(poolJson.abi, address);
    return pool;
}

async function getPoolAddressFromPair(factory, token0, token1, fee) {
    const poolAddress = await factory.methods.getPool(token0, token1, fee).call();
    return poolAddress;
}

module.exports = {
    getPool,
    getPoolAddressFromPair
};