## `MiningFixRangeBoost`






### `getBaseTokenStatus(uint256 tokenId) → struct MiningBase.BaseTokenStatus t` (internal)





### `constructor(address _uniV3NFTManager, address token0, address token1, uint24 fee, struct MiningBase.RewardInfo[] _rewardInfos, address iziTokenAddr, int24 _rewardUpperTick, int24 _rewardLowerTick, uint256 _startBlock, uint256 _endBlock)` (public)





### `onERC721Received(address, address, uint256, bytes) → bytes4` (public)

Used for ERC721 safeTransferFrom



### `getMiningContractInfo() → address token0_, address token1_, uint24 fee_, struct MiningBase.RewardInfo[] rewardInfos_, address iziTokenAddr_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_` (external)

Get the overall info for the mining contract.



### `_getVLiquidityForNFT(int24 tickLower, int24 tickUpper, uint128 liquidity) → uint256 vLiquidity` (internal)

Compute the virtual liquidity from a position's parameters.


vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the
intersection between the position and the reward range.
We divided it by 1e6 to keep vLiquidity smaller than Q128 in most cases. This is safe since liqudity is usually a large number.

### `_newTokenStatus(uint256 tokenId, uint256 vLiquidity, uint256 validVLiquidity, uint256 nIZI)` (internal)

new a token status when touched.



### `_updateTokenStatus(uint256 tokenId, uint256 validVLiquidity, uint256 nIZI)` (internal)

update a token status when touched



### `_computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI) → uint256` (internal)





### `deposit(uint256 tokenId, uint256 nIZI) → uint256 vLiquidity` (external)

Deposit a single position.




### `withdraw(uint256 tokenId, bool noReward)` (external)

withdraw a single position.




### `collect(uint256 tokenId)` (external)

Collect pending reward for a single position.




### `collectAllTokens()` (external)

Collect all pending rewards.



### `emergenceWithdraw(uint256 tokenId)` (external)

If something goes wrong, we can send back user's nft and locked iZi






### `PoolInfo`


address token0


address token1


uint24 fee


### `TokenStatus`


uint256 vLiquidity


uint256 validVLiquidity


uint256 nIZI


uint256 lastTouchBlock


uint256[] lastTouchAccRewardPerShare



