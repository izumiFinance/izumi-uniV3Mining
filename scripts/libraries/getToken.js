
const { getWeb3 } = require('./getWeb3');
const { getContractABI } = require('./getContractJson');

function getToken(address) {
    const path = __dirname + '/../../artifacts/contracts/test/TestToken.sol/TestToken.json';
    const testTokenABI = getContractABI(path);
    const web3 = getWeb3();

    const testToken = new web3.eth.Contract(testTokenABI, address);
    return testToken;
}

module.exports = {
    getToken
}