# OldMiningOneSideBoost





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| TICK_MAX | int24 |
| TICK_MIN | int24 |
| uniIsETH | bool |
| uniToken | address |
| lockToken | address |
| uniV3NFTManager | address |
| uniFactory | address |
| swapPool | address |
| rewardPool | struct OldMiningOneSideBoost.PoolInfo |
| lastTouchBlock | uint256 |
| startBlock | uint256 |
| endBlock | uint256 |
| lockBoostMultiplier | uint256 |
| rewardInfos | mapping(uint256 => struct OldMiningOneSideBoost.RewardInfo) |
| rewardInfosLen | uint256 |
| owners | mapping(uint256 => address) |
| tokenStatus | mapping(uint256 => struct OldMiningOneSideBoost.TokenStatus) |
| iziToken | contract IERC20 |
| totalNIZI | uint256 |
| totalVLiquidity | uint256 |
| totalLock | uint256 |



## Functions

### receive
No description


#### Declaration
```solidity
  function receive(
  ) external
```

#### Modifiers:
No modifiers



### _setRewardPool
No description


#### Declaration
```solidity
  function _setRewardPool(
  ) internal
```

#### Modifiers:
No modifiers



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
  ) external returns (address uniToken_, address lockToken_, uint24 fee_, uint256 lockBoostMultiplier_, address iziTokenAddr_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 totalLock_, uint256 totalNIZI_, uint256 startBlock_, uint256 endBlock_)
```

#### Modifiers:
No modifiers



### _newTokenStatus
new a token status when touched.


#### Declaration
```solidity
  function _newTokenStatus(
  ) internal
```

#### Modifiers:
No modifiers



### _updateTokenStatus
update a token status when touched


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



### _updateNIZI
No description


#### Declaration
```solidity
  function _updateNIZI(
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



### _computeValidVLiquidity
No description


#### Declaration
```solidity
  function _computeValidVLiquidity(
  ) internal returns (uint256)
```

#### Modifiers:
No modifiers



### getOraclePrice
No description


#### Declaration
```solidity
  function getOraclePrice(
  ) external returns (int24 avgTick, uint160 avgSqrtPriceX96)
```

#### Modifiers:
No modifiers



### safeTransferETH
Transfers ETH to the recipient address

> Fails with `STE`


#### Declaration
```solidity
  function safeTransferETH(
    address to,
    uint256 value
  ) internal
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`to` | address | The destination of the transfer
|`value` | uint256 | The value to be transferred

### depositWithuniToken
No description


#### Declaration
```solidity
  function depositWithuniToken(
  ) external nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |



### depositIZI
deposit iZi to an nft token



#### Declaration
```solidity
  function depositIZI(
    uint256 tokenId,
    uint256 deltaNIZI
  ) external nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | nft already deposited
|`deltaNIZI` | uint256 | amount of izi to deposit

### withdraw
Widthdraw a single position.



#### Declaration
```solidity
  function withdraw(
    uint256 tokenId,
    bool noReward
  ) external nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.
|`noReward` | bool | true if use want to withdraw without reward

### _collectReward
Collect pending reward for a single position.



#### Declaration
```solidity
  function _collectReward(
    uint256 tokenId
  ) internal
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### collect
Collect pending reward for a single position.



#### Declaration
```solidity
  function collect(
    uint256 tokenId
  ) external nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.

### collectAllTokens
Collect all pending rewards.


#### Declaration
```solidity
  function collectAllTokens(
  ) external nonReentrant
```

#### Modifiers:
| Modifier |
| --- |
| nonReentrant |



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

### _getRewardBlockNum
Return reward multiplier over the given _from to _to block.



#### Declaration
```solidity
  function _getRewardBlockNum(
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

### pendingReward
View function to see pending Reward for a single position.



#### Declaration
```solidity
  function pendingReward(
    uint256 tokenId
  ) public returns (uint256[])
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
  ) external returns (uint256[])
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`_user` | address | The related address.

### emergenceWithdraw
If something goes wrong, we can send back user's nft and locked assets



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
    uint256 rewardIdx,
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
|`rewardIdx` | uint256 | which rewardInfo to modify
|`_rewardPerBlock` | uint256 | new reward per block

### modifyProvider
Set new reward provider.



#### Declaration
```solidity
  function modifyProvider(
    uint256 rewardIdx,
    address provider
  ) external onlyOwner
```

#### Modifiers:
| Modifier |
| --- |
| onlyOwner |

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`rewardIdx` | uint256 | which rewardInfo to modify
|`provider` | address | New provider



## Events

### Deposit
No description

  


### Withdraw
No description

  


### CollectReward
No description

  


### ModifyEndBlock
No description

  


### ModifyRewardPerBlock
No description

  


### ModifyProvider
No description

  


