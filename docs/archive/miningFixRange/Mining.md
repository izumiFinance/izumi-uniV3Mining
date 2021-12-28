# Mining





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| rewardPool | struct Mining.PoolInfo |
| rewardToken | contract IERC20 |
| uniV3NFTManager | contract PositionManagerV3 |
| rewardUpperTick | int24 |
| rewardLowerTick | int24 |
| accRewardPerShare | uint256 |
| lastTouchBlock | uint256 |
| rewardPerBlock | uint256 |
| totalVLiquidity | uint256 |
| startBlock | uint256 |
| endBlock | uint256 |
| owners | mapping(uint256 => address) |
| tokenStatus | mapping(uint256 => struct Mining.TokenStatus) |
| Q128 | uint256 |



## Functions

### constructor
No description


#### Declaration
```solidity
  function constructor(
  ) public
```

#### Modifiers:
No modifiers



### getMiningContractInfo
Get the overall info for the mining contract.


#### Declaration
```solidity
  function getMiningContractInfo(
  ) external returns (address token0_, address token1_, uint24 fee_, address rewardToken_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 accRewardPerShare_, uint256 lastTouchBlock_, uint256 rewardPerBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_)
```

#### Modifiers:
No modifiers



### _getVLiquidityForNFT
Compute the virtual liquidity from a position's parameters.

> vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the 
intersection between the position and the reward range. 
We divided it by 1e6 to keep vLiquidity smaller than 1e128. This is safe since liqudity is usually a large number.

#### Declaration
```solidity
  function _getVLiquidityForNFT(
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity
  ) internal returns (uint256 vLiquidity)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tickLower` | int24 | The lower tick of a position.
|`tickUpper` | int24 | The upper tick of a position.
|`liquidity` | uint128 | The liquidity of a a position.


### _updateTokenStatus
Update a token status when touched.


#### Declaration
```solidity
  function _updateTokenStatus(
  ) internal
```

#### Modifiers:
No modifiers



### _updateVLiquidity
Update reward variables to be up-to-date.


#### Declaration
```solidity
  function _updateVLiquidity(
  ) internal
```

#### Modifiers:
No modifiers



### _updateGlobalStatus
Update the global status.


#### Declaration
```solidity
  function _updateGlobalStatus(
  ) internal
```

#### Modifiers:
No modifiers



### _getMultiplier
Return reward multiplier over the given _from to _to block.



#### Declaration
```solidity
  function _getMultiplier(
    uint256 _from,
    uint256 _to
  ) internal returns (uint256)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_from` | uint256 | The start block.
|`_to` | uint256 | The end block.

### deposit
Deposit a single position.



#### Declaration
```solidity
  function deposit(
    uint256 tokenId
  ) external returns (uint256 vLiquidity)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### withdraw
Widthdraw a single position.



#### Declaration
```solidity
  function withdraw(
    uint256 tokenId
  ) external
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### collectReward
Collect pending reward for a single position.



#### Declaration
```solidity
  function collectReward(
    uint256 tokenId
  ) public nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### collectRewards
Collect all pending rewards.


#### Declaration
```solidity
  function collectRewards(
  ) external
```

#### Modifiers:
No modifiers



### getTokenIds
View function to get position ids staked here for an user.



#### Declaration
```solidity
  function getTokenIds(
    address _user
  ) external returns (uint256[])
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_user` | address | The related address.

### pendingReward
View function to see pending Reward for a single position.



#### Declaration
```solidity
  function pendingReward(
    uint256 tokenId
  ) external returns (uint256)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### pendingRewards
View function to see pending Rewards for an address.



#### Declaration
```solidity
  function pendingRewards(
    address _user
  ) external returns (uint256)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_user` | address | The related address.

### withdrawNoReward
Widthdraw a single position without claiming rewards.



#### Declaration
```solidity
  function withdrawNoReward(
    uint256 tokenId
  ) public
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### emergenceWithdraw
If something goes wrong, we can send back user's nft.



#### Declaration
```solidity
  function emergenceWithdraw(
    uint256 tokenId
  ) external onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### modifyEndBlock
Set new reward end block.



#### Declaration
```solidity
  function modifyEndBlock(
    uint256 _endBlock
  ) external onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_endBlock` | uint256 | New end block.

### modifyRewardPerBlock
Set new reward per block.



#### Declaration
```solidity
  function modifyRewardPerBlock(
    uint256 _rewardPerBlock
  ) external onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_rewardPerBlock` | uint256 | New end block.



## Events

### Deposit
No description

  


### Withdraw
No description

  


### WithdrawNoReward
No description

  


### CollectReward
No description

  


### ModifyEndBlock
No description

  


### ModifyRewardPerBlock
No description

  


