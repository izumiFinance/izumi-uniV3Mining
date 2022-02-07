const getNftManager = require('./getNftManager');
const getFactory = require('./getFactory');
const {getNfts, getNftDetails} = require('./getNfts');
const { getPool, getPoolAddressFromPair } = require('./getPool');

module.exports = {
    getFactory,
    getNftManager,
    getNfts,
    getNftDetails,
    getPoolAddressFromPair,
    getPool
};