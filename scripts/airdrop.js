var Web3 = require('web3');
const secret = require('../.secret.js')
const BigNumber = require('bignumber.js')
var web3 = new Web3(new Web3.providers.HttpProvider('http://47.241.103.6:9545'));
var pk = secret.pk;

const hardhat = require("hardhat");

const contracts = require("./deployed.js");
const managerJson = require(contracts.nftMangerJson);
const managerAddress = contracts.nftManger;

const v = process.argv
const net = process.env.HARDHAT_NETWORK


// Example: HARDHAT_NETWORK='izumiTest' node airdrop.js ${PATH_TO_AIRDROP_ADDR_LIST}

const para = {
    fpath: v[2],
}
function getAddressList(path) {
    const fs = require('fs');
    let rawdata = fs.readFileSync(path);
    let data = rawdata.toString().split('\n');
    // console.log(data);
    return data;
}

function getContractJson(path) {
    const fs = require('fs');
    let rawdata = fs.readFileSync(path);
    let data = JSON.parse(rawdata);
    return data;
}
function getAirdropABI() {
    var airdropJson = getContractJson(__dirname + "/../artifacts/contracts/airdrop/Airdrop.sol/Airdrop.json");
    return airdropJson.abi;
}

async function attachToken(address) {
    var tokenFactory = await hardhat.ethers.getContractFactory("TestToken");
    var token = tokenFactory.attach(address);
    return token;
}

async function getDecimal(token) {
    var decimal = await token.decimals();
    return decimal;
}
async function getNumNoDecimal(tokenAddr, num) {
    var token = await attachToken(tokenAddr);
    var decimal = await getDecimal(token);
    console.log('decimal: ', decimal);
    console.log('num: ', num);
    var numNoDecimal = BigNumber(num).times(10 ** decimal);
    console.log('numNoDecimal: ', numNoDecimal.toFixed(0));
    return numNoDecimal.toFixed(0);
}

function getCallingsOfAddress(airdrop, address, amounts) {
    var callings = [];
    for (var tokenAddress in amounts) {
        var amountNoDecimal = amounts[tokenAddress];
        // console.log('amountNoDecimal: ', amountNoDecimal);
        callings.push(
            airdrop.methods.airdrop(tokenAddress, address, amountNoDecimal).encodeABI()
        );
    }
    return callings;
}
//mint uniswap v3 nft
async function main() {
    const addressList = getAddressList(para.fpath);

    var originSendAddrNum = 50;

    var airdropABI = getAirdropABI();
    var airdropAddr = contracts.izumiTest.AIRDROP;
    var airdrop = new web3.eth.Contract(airdropABI, airdropAddr);

    var zeroAddressForEth = '0x0000000000000000000000000000000000000000';
    var amountsDecimal = {
        'ETH': 10,
        'stETH': 10,
        'USDC': 10000,
        'USDT': 10000,
        'iZi': 5000,
        'BIT': 5000,
        'MIM': 5000,
    };
    var amountsNoDecimal = {};
    // for (var key in amountsDecimal) {
    //     console.log('key: ', key);
    // }
    for (var symbol in amountsDecimal) {
        console.log('key: ', symbol);
        if (symbol == 'ETH') {
            var amountDecimal = amountsDecimal[symbol];
            amountsNoDecimal[zeroAddressForEth] = hardhat.ethers.utils.parseEther(amountDecimal.toString()).toString();
        } else {
            var tokenAddress = contracts[net][symbol];
            var amountDecimal = amountsDecimal[symbol];
            amountsNoDecimal[tokenAddress] = await getNumNoDecimal(tokenAddress, amountDecimal);
        }
    }
    console.log(amountsNoDecimal);
    var addrListLen = addressList.length;
    var addrDelta = 10;
    var sendNumThisTime = 0;
    for (var addrListStart = originSendAddrNum; addrListStart < addrListLen; addrListStart += addrDelta) {
        var addrListEnd = addrListStart + addrDelta;
        if (addrListEnd > addrListLen) {
            addrListEnd = addrListLen;
        }
        // console.log(address);
        var callings = [];
        var addrSubList = addressList.slice(addrListStart, addrListEnd);
        // console.log('addr sub list:' , addrSubList);
        for (address of addrSubList) {
            var cs = getCallingsOfAddress(airdrop, address, amountsNoDecimal);
            callings = callings.concat(cs);
        }
        // console.log('callings: ', callings);

        const txData = await airdrop.methods.multicall(callings).encodeABI()
        const signedTx = await web3.eth.accounts.signTransaction(
            {
                to: airdropAddr,
                data:txData,
                gas: 8000000,
            }, 
            pk
        );
        const tx = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('airdrop addresses: ', addrSubList);
        sendNumThisTime += addrSubList.length;
        console.log('send num: ', originSendAddrNum + sendNumThisTime);
    }
}
main().then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
})
