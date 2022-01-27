
async function getNfts(nftManager, account) {
    const nftNumResponse = await nftManager.methods.balanceOf(account).call();
    const nftNum = Number(nftNumResponse);
    let nftIds = [];
    for (let i = 0; i < nftNum; i += 100) {
        let boundary = Math.min(nftNum, i + 100);
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

module.exports = getNfts;