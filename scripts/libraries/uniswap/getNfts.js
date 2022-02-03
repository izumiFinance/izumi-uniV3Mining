
async function getNfts(nftManager, account) {
    const nftNumResponse = await nftManager.methods.balanceOf(account).call();
    const nftNum = Number(nftNumResponse);
    let nftIds = [];
    for (let i = 0; i < nftNum; i += 20) {
        let boundary = Math.min(nftNum, i + 20);
        const tokenIdMulticallData = [];
        for (let j = i; j < boundary; j ++) {
            tokenIdMulticallData.push(nftManager.methods.tokenOfOwnerByIndex(account, j).encodeABI());
        }
        const response = await nftManager.methods.multicall(tokenIdMulticallData).call();
        for (nft of response) {
            nftIds.push(Number(nft));
        }
    }
    return nftIds;
}

/*

            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
*/

async function getNftDetails(web3, nftManager, nftIds) {
    const nftNum = nftIds.length;
    params = [{
        type: 'uint96',
        name: 'nonce'
    },{
        type: 'address',
        name: 'operator'
    },{
        type: 'address',
        name: 'token0'
    },{
        type: 'address',
        name: 'token1'
    },{
        type: 'uint24',
        name: 'fee'
    },{
        type: 'int24',
        name: 'tickLower'
    },{
        type: 'int24',
        name: 'tickUpper'
    },{
        type: 'uint128',
        name: 'liquidity'
    },{
        type: 'uint256',
        name: 'feeGrowthInside0LastX128'
    },{
        type: 'uint256',
        name: 'feeGrowthInside1LastX128'
    },{
        type: 'uint128',
        name: 'tokensOwed0'
    },{
        type: 'uint128',
        name: 'tokensOwed1'
    },
    ];
    const result = [];
    for (let i = 0; i < nftNum; i += 100) {
        const boundary = Math.min(nftNum, i + 100);
        const tokenIdMulticallData = [];
        for (let j = i; j < boundary; j ++) {
            tokenIdMulticallData.push(nftManager.methods.positions(nftIds[j]).encodeABI());
        }
        const response = await nftManager.methods.multicall(tokenIdMulticallData).call();
        for (const positionResponse of response) {
            const res = web3.eth.abi.decodeParameters(params, positionResponse);
            result.push(res);
        }
    }
    return result;
}

module.exports = {getNfts, getNftDetails};