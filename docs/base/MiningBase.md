## `MiningBase`






### `_updateVLiquidity(uint256 vLiquidity, bool isAdd)` (internal)

Update reward variables to be up-to-date.



### `_updateNIZI(uint256 nIZI, bool isAdd)` (internal)





### `_updateGlobalStatus()` (internal)

Update the global status.



### `_computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI) → uint256` (internal)





### `_updateTokenStatus(uint256 tokenId, uint256 validVLiquidity, uint256 nIZI)` (internal)

update a token status when touched



### `getBaseTokenStatus(uint256 tokenId) → struct MiningBase.BaseTokenStatus t` (internal)





### `depositIZI(uint256 tokenId, uint256 deltaNIZI)` (external)

deposit iZi to an nft token




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






### `RewardInfo`


address rewardToken


address provider


uint256 accRewardPerShare


uint256 rewardPerBlock


### `BaseTokenStatus`


uint256 vLiquidity


uint256 validVLiquidity


uint256 nIZI


uint256[] lastTouchAccRewardPerShare



