const { getWeb3 } = require('../getWeb3');
const deployed = require('../../deployed.js');
const managerJson = require(deployed.nftManagerJson);

function getNftManager(address) {
    const web3 = getWeb3();
    const manager = new web3.eth.Contract(managerJson.abi, address);
    return manager;
}

module.exports = getNftManager;