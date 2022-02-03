const { getWeb3 } = require('../getWeb3');
const deployed = require('../../deployed.js');
const factoryJson = require(deployed.factoryJson);

function getFactory(address) {
    const web3 = getWeb3();
    const factory = new web3.eth.Contract(factoryJson.abi, address);
    return factory;
}

module.exports = getFactory;