
function getContractJson(path) {
    const fs = require('fs');
    let rawdata = fs.readFileSync(path);
    let data = JSON.parse(rawdata);
    return data;
}

function getContractABI(path) {
    const json = getContractJson(path);
    return json.abi;
}


module.exports ={ getContractABI };