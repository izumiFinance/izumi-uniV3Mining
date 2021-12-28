# INonfungiblePositionManager





## Contents
<!-- START doctoc -->
<!-- END doctoc -->




## Functions

### factory
No description


#### Declaration
```solidity
  function factory(
  ) external returns (address)
```

#### Modifiers:
No modifiers


#### Returns:
| Type | Description |
| --- | --- |
|`Returns` | the address of the Uniswap V3 factory
### WETH9
No description


#### Declaration
```solidity
  function WETH9(
  ) external returns (address)
```

#### Modifiers:
No modifiers


#### Returns:
| Type | Description |
| --- | --- |
|`Returns` | the address of WETH9
### positions
No description


#### Declaration
```solidity
  function positions(
  ) external returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)
```

#### Modifiers:
No modifiers



### refundETH
Refunds any ETH balance held by this contract to the `msg.sender`

> Useful for bundling with mint or increase liquidity that uses ether, or exact output swaps
that use ether for the input amount

#### Declaration
```solidity
  function refundETH(
  ) external
```

#### Modifiers:
No modifiers



### mint
Creates a new position wrapped in a NFT

> Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
a method does not exist, i.e. the pool is assumed to be initialized.


#### Declaration
```solidity
  function mint(
    struct INonfungiblePositionManager.MintParams params
  ) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`params` | struct INonfungiblePositionManager.MintParams | The params necessary to mint a position, encoded as `MintParams` in calldata

#### Returns:
| Type | Description |
| --- | --- |
|`tokenId` | The ID of the token that represents the minted position
|`liquidity` | The amount of liquidity for this position
|`amount0` | The amount of token0
|`amount1` | The amount of token1
### decreaseLiquidity
Decreases the amount of liquidity in a position and accounts it to the position



#### Declaration
```solidity
  function decreaseLiquidity(
    struct INonfungiblePositionManager.DecreaseLiquidityParams params
  ) external returns (uint256 amount0, uint256 amount1)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`params` | struct INonfungiblePositionManager.DecreaseLiquidityParams | tokenId The ID of the token for which liquidity is being decreased,
amount The amount by which liquidity will be decreased,
amount0Min The minimum amount of token0 that should be accounted for the burned liquidity,
amount1Min The minimum amount of token1 that should be accounted for the burned liquidity,
deadline The time by which the transaction must be included to effect the change

#### Returns:
| Type | Description |
| --- | --- |
|`amount0` | The amount of token0 accounted to the position's tokens owed
|`amount1` | The amount of token1 accounted to the position's tokens owed
### collect
Collects up to a maximum amount of fees owed to a specific position to the recipient



#### Declaration
```solidity
  function collect(
    struct INonfungiblePositionManager.CollectParams params
  ) external returns (uint256 amount0, uint256 amount1)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`params` | struct INonfungiblePositionManager.CollectParams | tokenId The ID of the NFT for which tokens are being collected,
recipient The account that should receive the tokens,
amount0Max The maximum amount of token0 to collect,
amount1Max The maximum amount of token1 to collect

#### Returns:
| Type | Description |
| --- | --- |
|`amount0` | The amount of fees collected in token0
|`amount1` | The amount of fees collected in token1
### safeTransferFrom
No description


#### Declaration
```solidity
  function safeTransferFrom(
  ) external
```

#### Modifiers:
No modifiers



### ownerOf
No description


#### Declaration
```solidity
  function ownerOf(
  ) external returns (address)
```

#### Modifiers:
No modifiers



### transferFrom
No description


#### Declaration
```solidity
  function transferFrom(
  ) external
```

#### Modifiers:
No modifiers





