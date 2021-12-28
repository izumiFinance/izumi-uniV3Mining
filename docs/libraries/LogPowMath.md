# LogPowMath





## Contents
<!-- START doctoc -->
<!-- END doctoc -->

## Globals

> Note this contains internal vars as well due to a bug in the docgen procedure

| Var | Type |
| --- | --- |
| MIN_POINT | int24 |
| MAX_POINT | int24 |
| MIN_SQRT_PRICE | uint160 |
| MAX_SQRT_PRICE | uint160 |



## Functions

### getSqrtPrice
sqrt(1.0001^point) in form oy 96-bit fix point num


#### Declaration
```solidity
  function getSqrtPrice(
  ) internal returns (uint160 sqrtPrice_96)
```

#### Modifiers:
No modifiers



### getLogSqrtPriceFloor
No description


#### Declaration
```solidity
  function getLogSqrtPriceFloor(
  ) internal returns (int24 logValue)
```

#### Modifiers:
No modifiers



### getLogSqrtPriceFU
No description


#### Declaration
```solidity
  function getLogSqrtPriceFU(
  ) internal returns (int24 logFloor, int24 logUpper)
```

#### Modifiers:
No modifiers





