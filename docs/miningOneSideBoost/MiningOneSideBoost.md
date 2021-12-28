# MiningOneSideBoost





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
| rewardPool | struct MiningOneSideBoost.PoolInfo |
| lockBoostMultiplier | uint256 |
| totalLock | uint256 |
| tokenStatus | mapping(uint256 => struct MiningOneSideBoost.TokenStatus) |



## Functions

### getBaseTokenStatus
No description


#### Declaration
```solidity
  function getBaseTokenStatus(
  ) internal returns (struct MiningBase.BaseTokenStatus t)
```

#### Modifiers:
No modifiers



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



