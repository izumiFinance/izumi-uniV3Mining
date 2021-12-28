## `OldMiningFixRangeBoost`






### `lastTouchAccRewardPerShare(uint256 tokenId) → uint256[] lta` (external)





### `constructor(address _uniV3NFTManager, address token0, address token1, uint24 fee, struct OldMiningFixRangeBoost.RewardInfo[] _rewardInfos, address iziTokenAddr, int24 _rewardUpperTick, int24 _rewardLowerTick, uint256 _startBlock, uint256 _endBlock)` (public)





### `onERC721Received(address, address, uint256, bytes) → bytes4` (public)

Used for ERC721 safeTransferFrom



### `getMiningContractInfo() → address token0_, address token1_, uint24 fee_, struct OldMiningFixRangeBoost.RewardInfo[] rewardInfos_, address iziTokenAddr_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_` (external)

Get the overall info for the mining contract.



### `_getVLiquidityForNFT(int24 tickLower, int24 tickUpper, uint128 liquidity) → uint256 vLiquidity` (internal)

Compute the virtual liquidity from a position's parameters.


vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the
intersection between the position and the reward range.
We divided it by 1e6 to keep vLiquidity smaller than Q128 in most cases. This is safe since liqudity is usually a large number.

### `_newTokenStatus(uint256 tokenId, uint256 vLiquidity, uint256 validVLiquidity, uint256 nIZI)` (internal)

new a token status when touched.



### `_updateTokenStatus(uint256 tokenId, uint256 vLiquidity, uint256 validVLiquidity, uint256 nIZI)` (internal)

update a token status when touched



### `_updateVLiquidity(uint256 vLiquidity, bool isAdd)` (internal)

Update reward variables to be up-to-date.



### `_updateNIZI(uint256 nIZI, bool isAdd)` (internal)





### `_updateGlobalStatus()` (internal)

Update the global status.



### `_computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI) → uint256` (internal)





### `deposit(uint256 tokenId, uint256 nIZI) → uint256 vLiquidity` (external)

Deposit a single position.




### `depositIZI(uint256 tokenId, uint256 deltaNIZI)` (external)

deposit iZi to an nft token




### `withdraw(uint256 tokenId, bool noReward)` (external)

withdraw a single position.




### `_collectReward(uint256 tokenId)` (internal)

Collect pending reward for a single position.




### `collectReward(uint256 tokenId)` (external)

Collect pending reward for a single position.




### `collectRewards()` (external)

Collect all pending rewards.



### `getTokenIds(address _user) → uint256[]` (external)

View function to get position ids staked here for an user.




### `_getMultiplier(uint256 _from, uint256 _to) → uint256` (internal)

Return reward multiplier over the given _from to _to block.




### `pendingReward(uint256 tokenId) → uint256[]` (public)

View function to see pending Reward for a single position.




### `pendingRewards(address _user) → uint256[]` (external)

View function to see pending Rewards for an address.




### `emergenceWithdraw(uint256 tokenId)` (external)

If something goes wrong, we can send back user's nft and locked iZi




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


uint256 vLiquidity


uint256 validVLiquidity


uint256 nIZI


uint256 lastTouchBlock


uint256[] lastTouchAccRewardPerShare



