## `OldMiningOneSideBoost`






### `receive()` (external)





### `_setRewardPool(address _uniToken, address _lockToken, uint24 fee)` (internal)





### `constructor(struct OldMiningOneSideBoost.PoolParams poolParams, struct OldMiningOneSideBoost.RewardInfo[] _rewardInfos, uint256 _lockBoostMultiplier, address iziTokenAddr, uint256 _startBlock, uint256 _endBlock)` (public)





### `getMiningContractInfo() → address uniToken_, address lockToken_, uint24 fee_, uint256 lockBoostMultiplier_, address iziTokenAddr_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 totalLock_, uint256 totalNIZI_, uint256 startBlock_, uint256 endBlock_` (external)

Get the overall info for the mining contract.



### `_newTokenStatus(struct OldMiningOneSideBoost.TokenStatus newTokenStatus)` (internal)

new a token status when touched.



### `_updateTokenStatus(uint256 tokenId, uint256 validVLiquidity, uint256 nIZI)` (internal)

update a token status when touched



### `_updateVLiquidity(uint256 vLiquidity, bool isAdd)` (internal)

Update reward variables to be up-to-date.



### `_updateNIZI(uint256 nIZI, bool isAdd)` (internal)





### `_updateGlobalStatus()` (internal)

Update the global status.



### `_computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI) → uint256` (internal)





### `getOraclePrice() → int24 avgTick, uint160 avgSqrtPriceX96` (external)





### `safeTransferETH(address to, uint256 value)` (internal)

Transfers ETH to the recipient address


Fails with `STE`


### `depositWithuniToken(uint256 uniAmount, uint256 numIZI, uint256 deadline)` (external)





### `depositIZI(uint256 tokenId, uint256 deltaNIZI)` (external)

deposit iZi to an nft token




### `withdraw(uint256 tokenId, bool noReward)` (external)

Widthdraw a single position.




### `_collectReward(uint256 tokenId)` (internal)

Collect pending reward for a single position.




### `collect(uint256 tokenId)` (external)

Collect pending reward for a single position.




### `collectAllTokens()` (external)

Collect all pending rewards.



### `getTokenIds(address _user) → uint256[]` (external)

View function to get position ids staked here for an user.




### `_getRewardBlockNum(uint256 _from, uint256 _to) → uint256` (internal)

Return reward multiplier over the given _from to _to block.




### `pendingReward(uint256 tokenId) → uint256[]` (public)

View function to see pending Reward for a single position.




### `pendingRewards(address _user) → uint256[]` (external)

View function to see pending Rewards for an address.




### `emergenceWithdraw(uint256 tokenId)` (external)

If something goes wrong, we can send back user's nft and locked assets




### `modifyEndBlock(uint256 _endBlock)` (external)

Set new reward end block.




### `modifyRewardPerBlock(uint256 rewardIdx, uint256 _rewardPerBlock)` (external)

Set new reward per block.




### `modifyProvider(uint256 rewardIdx, address provider)` (external)

Set new reward provider.





### `Deposit(address user, uint256 tokenId, uint256 nIZI)`





### `Withdraw(address user, uint256 tokenId)`





### `CollectReward(address user, uint256 tokenId, address token, uint256 amount)`





### `ModifyEndBlock(uint256 endBlock)`





### `ModifyRewardPerBlock(address rewardToken, uint256 rewardPerBlock)`





### `ModifyProvider(address rewardToken, address provider)`






### `PoolInfo`


address token0


address token1


uint24 fee


### `RewardInfo`


address rewardToken


address provider


uint256 accRewardPerShare


uint256 rewardPerBlock


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



