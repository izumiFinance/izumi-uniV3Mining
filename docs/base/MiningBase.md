# MiningBase





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| lastTouchBlock | uint256 |
| startBlock | uint256 |
| endBlock | uint256 |
| rewardInfos | mapping(uint256 => struct MiningBase.RewardInfo) |
| rewardInfosLen | uint256 |
| owners | mapping(uint256 => address) |
| tokenIds | mapping(address => struct EnumerableSet.UintSet) |
| iziToken | contract IERC20 |
| totalNIZI | uint256 |
| totalVLiquidity | uint256 |



## Functions

### _updateVLiquidity
Update reward variables to be up-to-date.



#### Declaration
```solidity
  function _updateVLiquidity(
    uint256 vLiquidity,
    bool isAdd
  ) internal
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`vLiquidity` | uint256 | vLiquidity to add or minus
|`isAdd` | bool | add or minus

### _updateNIZI
Update reward variables to be up-to-date.



#### Declaration
```solidity
  function _updateNIZI(
    uint256 nIZI,
    bool isAdd
  ) internal
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`nIZI` | uint256 | amount of boosted iZi to add or minus
|`isAdd` | bool | add or minus

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
compute validVLiquidity



#### Declaration
```solidity
  function _computeValidVLiquidity(
    uint256 vLiquidity,
    uint256 nIZI
  ) internal returns (uint256)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`vLiquidity` | uint256 | origin vLiquidity
|`nIZI` | uint256 | amount of boosted iZi

### _updateTokenStatus
update a token status when touched



#### Declaration
```solidity
  function _updateTokenStatus(
    uint256 tokenId,
    uint256 validVLiquidity,
    uint256 nIZI
  ) internal
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | id of TokenStatus obj in sub-contracts (same with uniswap nft id)
|`validVLiquidity` | uint256 | validVLiquidity, can be acquired by _computeValidVLiquidity(...)
|`nIZI` | uint256 | latest amount of iZi boost

### getBaseTokenStatus
get base infomation from token status in sub-contracts



#### Declaration
```solidity
  function getBaseTokenStatus(
    uint256 tokenId
  ) internal returns (struct MiningBase.BaseTokenStatus t)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenId` | uint256 | id of TokenStatus obj in sub-contracts

#### Returns:
| Type | Description |
| --- | --- |
|`t` | contains base infomation (uint256 vLiquidity, uint256 validVLiquidity, uint256 nIZI, uint256[] lastTouchAccRewardPerShare)
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

### _collectReward
Collect pending reward for a single position. can be called by sub-contracts



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

#### Returns:
| Type | Description |
| --- | --- |
|`list` | of tokenId
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

#### Returns:
| Type | Description |
| --- | --- |
|`list` | of pending reward amount for each reward ERC20-token of tokenId
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

#### Returns:
| Type | Description |
| --- | --- |
|`list` | of pending reward amount for each reward ERC20-token of this user
### emergenceWithdraw
If something goes wrong, we can send back user's nft and locked assets



#### Declaration
```solidity
  function emergenceWithdraw(
    uint256 tokenId
  ) external
```

#### Modifiers:
No modifiers

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

  


