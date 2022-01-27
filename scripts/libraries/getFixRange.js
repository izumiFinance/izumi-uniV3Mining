
const { getWeb3 } = require('./getWeb3');
const { getContractABI } = require('./getContractJson');

function getFixRange(address) {
    const path = __dirname + '/../../artifacts/contracts/miningFixRangeBoost/MiningFixRangeBoostV2.sol/MiningFixRangeBoostV2.json';
    const miningFixRangeBoostV2ABI = getContractABI(path);
    const web3 = getWeb3();

    const miningFixRangeBoostV2 = new web3.eth.Contract(miningFixRangeBoostV2ABI, address);
    return miningFixRangeBoostV2;
}

module.exports = {
    getFixRange
}