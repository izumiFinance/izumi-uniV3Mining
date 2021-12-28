## `Mining`






### `constructor(address _uniV3NFTManager, address token0, address token1, uint24 fee, address _rewardToken, uint256 _rewardPerBlock, int24 _rewardUpperTick, int24 _rewardLowerTick, uint256 _startBlock, uint256 _endBlock)` (public)





### `getMiningContractInfo() → address token0_, address token1_, uint24 fee_, address rewardToken_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 accRewardPerShare_, uint256 lastTouchBlock_, uint256 rewardPerBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_` (external)

Get the overall info for the mining contract.



### `_getVLiquidityForNFT(int24 tickLower, int24 tickUpper, uint128 liquidity) → uint256 vLiquidity` (internal)

Compute the virtual liquidity from a position's parameters.


vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the 
intersection between the position and the reward range. 
We divided it by 1e6 to keep vLiquidity smaller than 1e128. This is safe since liqudity is usually a large number.

### `_updateTokenStatus(uint256 tokenId, uint256 vLiquidity)` (internal)

Update a token status when touched.



### `_updateVLiquidity(uint256 vLiquidity, bool isAdd)` (internal)

Update reward variables to be up-to-date.



### `_updateGlobalStatus()` (internal)

Update the global status.



### `_getMultiplier(uint256 _from, uint256 _to) → uint256` (internal)

Return reward multiplier over the given _from to _to block.




### `deposit(uint256 tokenId) → uint256 vLiquidity` (external)

Deposit a single position.




### `withdraw(uint256 tokenId)` (external)

Widthdraw a single position.




### `collectReward(uint256 tokenId)` (public)

Collect pending reward for a single position.




### `collectRewards()` (external)

Collect all pending rewards.



### `getTokenIds(address _user) → uint256[]` (external)

View function to get position ids staked here for an user.




### `pendingReward(uint256 tokenId) → uint256` (external)

View function to see pending Reward for a single position.




### `pendingRewards(address _user) → uint256` (external)

View function to see pending Rewards for an address.




### `withdrawNoReward(uint256 tokenId)` (public)

Widthdraw a single position without claiming rewards.




### `emergenceWithdraw(uint256 tokenId)` (external)

If something goes wrong, we can send back user's nft.




### `modifyEndBlock(uint256 _endBlock)` (external)

Set new reward end block.




### `modifyRewardPerBlock(uint256 _rewardPerBlock)` (external)

Set new reward per block.





### `Deposit(address user, uint256 tokenId)`





### `Withdraw(address user, uint256 tokenId)`





### `WithdrawNoReward(address user, uint256 tokenId)`





### `CollectReward(address user, uint256 tokenId, uint256 amount)`





### `ModifyEndBlock(uint256 endBlock)`





### `ModifyRewardPerBlock(uint256 rewardPerBlock)`






### `PoolInfo`


address token0


address token1


uint24 fee


### `TokenStatus`


uint256 vLiquidity


uint256 lastTouchBlock


uint256 lastTouchAccRewardPerShare



