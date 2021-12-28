# OldMiningFixRangeBoost





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| uniV3NFTManager | contract PositionManagerV3 |
| rewardPool | struct OldMiningFixRangeBoost.PoolInfo |
| rewardUpperTick | int24 |
| rewardLowerTick | int24 |
| lastTouchBlock | uint256 |
| startBlock | uint256 |
| endBlock | uint256 |
| rewardInfos | mapping(uint256 => struct OldMiningFixRangeBoost.RewardInfo) |
| rewardInfosLen | uint256 |
| owners | mapping(uint256 => address) |
| tokenStatus | mapping(uint256 => struct OldMiningFixRangeBoost.TokenStatus) |
| iziToken | contract IERC20 |
| totalNIZI | uint256 |
| totalVLiquidity | uint256 |
| Q128 | uint256 |



## Functions

### lastTouchAccRewardPerShare
No description


#### Declaration
```solidity
  function lastTouchAccRewardPerShare(
  ) external returns (uint256[] lta)
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



### onERC721Received
Used for ERC721 safeTransferFrom


#### Declaration
```solidity
  function onERC721Received(
  ) public returns (bytes4)
```

#### Modifiers:
No modifiers



### getMiningContractInfo
Get the overall info for the mining contract.


#### Declaration
```solidity
  function getMiningContractInfo(
  ) external returns (address token0_, address token1_, uint24 fee_, struct OldMiningFixRangeBoost.RewardInfo[] rewardInfos_, address iziTokenAddr_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_)
```

#### Modifiers:
No modifiers



### _getVLiquidityForNFT
Compute the virtual liquidity from a position's parameters.

> vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the
intersection between the position and the reward range.
We divided it by 1e6 to keep vLiquidity smaller than Q128 in most cases. This is safe since liqudity is usually a large number.

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



### deposit
Deposit a single position.



#### Declaration
```solidity
  function deposit(
    uint256 tokenId,
    uint256 nIZI
  ) external returns (uint256 vLiquidity)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | The related position id.
|`nIZI` | uint256 | the amount of izi to lock

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
withdraw a single position.



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
|`noReward` | bool | true if donot collect reward

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

### collectReward
Collect pending reward for a single position.



#### Declaration
```solidity
  function collectReward(
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

### collectRewards
Collect all pending rewards.


#### Declaration
```solidity
  function collectRewards(
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
If something goes wrong, we can send back user's nft and locked iZi



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

  


