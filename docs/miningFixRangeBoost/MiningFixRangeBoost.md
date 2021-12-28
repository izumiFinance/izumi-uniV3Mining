# MiningFixRangeBoost





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| uniV3NFTManager | contract PositionManagerV3 |
| rewardPool | struct MiningFixRangeBoost.PoolInfo |
| rewardUpperTick | int24 |
| rewardLowerTick | int24 |
| tokenStatus | mapping(uint256 => struct MiningFixRangeBoost.TokenStatus) |



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
  ) external returns (address token0_, address token1_, uint24 fee_, struct MiningBase.RewardInfo[] rewardInfos_, address iziTokenAddr_, int24 rewardUpperTick_, int24 rewardLowerTick_, uint256 lastTouchBlock_, uint256 totalVLiquidity_, uint256 startBlock_, uint256 endBlock_)
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



