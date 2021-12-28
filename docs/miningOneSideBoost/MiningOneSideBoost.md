## `MiningOneSideBoost`






### `getBaseTokenStatus(uint256 tokenId) → struct MiningBase.BaseTokenStatus t` (internal)





### `receive()` (external)





### `_setRewardPool(address _uniToken, address _lockToken, uint24 fee)` (internal)





### `constructor(struct MiningOneSideBoost.PoolParams poolParams, struct MiningBase.RewardInfo[] _rewardInfos, uint256 _lockBoostMultiplier, address iziTokenAddr, uint256 _startBlock, uint256 _endBlock)` (public)





### `getMiningContractInfo() → address uniToken_, address lockToken_, uint24 fee_, uint256 lockBoostMultiplier_, address iziTokenAddr_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 totalLock_, uint256 totalNIZI_, uint256 startBlock_, uint256 endBlock_` (external)

Get the overall info for the mining contract.



### `_newTokenStatus(struct MiningOneSideBoost.TokenStatus newTokenStatus)` (internal)

new a token status when touched.



### `_updateTokenStatus(uint256 tokenId, uint256 validVLiquidity, uint256 nIZI)` (internal)

update a token status when touched



### `_computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI) → uint256` (internal)





### `getOraclePrice() → int24 avgTick, uint160 avgSqrtPriceX96` (external)





### `safeTransferETH(address to, uint256 value)` (internal)

Transfers ETH to the recipient address


Fails with `STE`


### `depositWithuniToken(uint256 uniAmount, uint256 numIZI, uint256 deadline)` (external)





### `withdraw(uint256 tokenId, bool noReward)` (external)

Widthdraw a single position.




### `collect(uint256 tokenId)` (external)

Collect pending reward for a single position.




### `collectAllTokens()` (external)

Collect all pending rewards.



### `emergenceWithdraw(uint256 tokenId)` (external)

If something goes wrong, we can send back user's nft and locked assets






### `PoolInfo`


address token0


address token1


uint24 fee


### `TokenStatus`


uint256 nftId


uint128 uniLiquidity


uint256 lockAmount


uint256 vLiquidity


uint256 validVLiquidity


uint256 nIZI


uint256 lastTouchBlock


uint256[] lastTouchAccRewardPerShare


### `PoolParams`


address uniV3NFTManager


address uniTokenAddr


address lockTokenAddr


uint24 fee



