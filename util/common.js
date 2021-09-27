const fs = require('fs');

function readJson() {
    const data = fs.readFileSync('../data/deployed.json');
    let deployedContracts = JSON.parse(data);
    return deployedContracts;
}

function writeJson(updateContracts) {
    let deployedContracts = readJson();
    for (var key in updateContracts) {
        deployedContracts[key] = updateContracts[key];
    }
    let data = JSON.stringify(deployedContracts, null, 2);
    fs.writeFileSync('deployed.json', data);
}

module.exports = {
    readJson,
    writeJson
}
