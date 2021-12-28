# UniswapCallingParams





## Contents
<!-- START doctoc -->
<!-- END doctoc -->




## Functions

### collectParams
No description


#### Declaration
```solidity
  function collectParams(
  ) internal returns (struct INonfungiblePositionManager.CollectParams params)
```

#### Modifiers:
No modifiers



### decreaseLiquidityParams
No description


#### Declaration
```solidity
  function decreaseLiquidityParams(
  ) internal returns (struct INonfungiblePositionManager.DecreaseLiquidityParams params)
```

#### Modifiers:
No modifiers



### mintParams
No description
> fill INonfungiblePositionManager.MintParams struct to call INonfungiblePositionManager.mint(...)


#### Declaration
```solidity
  function mintParams(
    address token0,
    address token1,
    uint24 fee,
    uint256 amount0,
    uint256 amount1,
    int24 tickLeft,
    int24 tickRight,
    uint256 deadline
  ) internal returns (struct INonfungiblePositionManager.MintParams params)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`token0` | address | one of token pair in uniswap pool, note here not necessary to ensure that token0 < token1
|`token1` | address | another token
|`fee` | uint24 | fee
|`amount0` | uint256 | amount of token0
|`amount1` | uint256 | amount of token1
|`tickLeft` | int24 | tickLower
|`tickRight` | int24 | tickUpper
|`deadline` | uint256 | deadline of mint calling

#### Returns:
| Type | Description |
| --- | --- |
|`params` | MintParams


