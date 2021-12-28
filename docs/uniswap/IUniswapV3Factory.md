# IUniswapV3Factory





## Contents
<!-- START doctoc -->
<!-- END doctoc -->




## Functions

### feeAmountTickSpacing
Returns the tick spacing for a given fee amount, if enabled, or 0 if not enabled

> A fee amount can never be removed, so this value should be hard coded or cached in the calling context


#### Declaration
```solidity
  function feeAmountTickSpacing(
    uint24 fee
  ) external returns (int24)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`fee` | uint24 | The enabled fee, denominated in hundredths of a bip. Returns 0 in case of unenabled fee

#### Returns:
| Type | Description |
| --- | --- |
|`The` | tick spacing
### getPool
Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist

> tokenA and tokenB may be passed in either token0/token1 or token1/token0 order


#### Declaration
```solidity
  function getPool(
    address tokenA,
    address tokenB,
    uint24 fee
  ) external returns (address pool)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`tokenA` | address | The contract address of either token0 or token1
|`tokenB` | address | The contract address of the other token
|`fee` | uint24 | The fee collected upon every swap in the pool, denominated in hundredths of a bip

#### Returns:
| Type | Description |
| --- | --- |
|`pool` | The pool address


