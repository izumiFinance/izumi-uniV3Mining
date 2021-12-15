

function getContractJson(path) {
    const fs = require('fs');
    let rawdata = fs.readFileSync(path);
    let data = JSON.parse(rawdata);
    return data;
}

async function deployWETH9(signer) {
    var WETH9Json = getContractJson(__dirname + '/../../externBuild/WETH9.json').WETH9;
    console.log('weth9json: ', WETH9Json.abi);
    var WETH9Factory = await ethers.getContractFactory(WETH9Json.abi, WETH9Json.bytecode, signer);
    var WETH9 = await WETH9Factory.deploy();
    await WETH9.deployed();
    return WETH9;
}

module.exports = {
    deployWETH9
}