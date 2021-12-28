# UniswapOracle





## Contents
<!-- START doctoc -->
<!-- END doctoc -->




## Functions

### getObservation
No description
> query a certain observation from uniswap pool


#### Declaration
```solidity
  function getObservation(
    address pool,
    uint256 observationIndex
  ) internal returns (struct UniswapOracle.Observation observation)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`pool` | address | address of uniswap pool
|`observationIndex` | uint256 | index of wanted observation

#### Returns:
| Type | Description |
| --- | --- |
|`observation` | desired observation, see Observation to learn more
### getObservationBoundary
No description
> query latest and oldest observations from uniswap pool


#### Declaration
```solidity
  function getObservationBoundary(
    address pool,
    uint16 latestIndex,
    uint16 observationCardinality
  ) internal returns (struct UniswapOracle.Observation oldestObservation, struct UniswapOracle.Observation latestObservation)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`pool` | address | address of uniswap pool
|`latestIndex` | uint16 | index of latest observation in the pool
|`observationCardinality` | uint16 | size of observation queue in the pool


### getSlot0
No description
> view slot0 infomations from uniswap pool


#### Declaration
```solidity
  function getSlot0(
    address pool
  ) internal returns (struct UniswapOracle.Slot0 slot0)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`pool` | address | address of uniswap

#### Returns:
| Type | Description |
| --- | --- |
|`slot0` | a Slot0 struct with necessary info, see Slot0 struct above
### getAvgTickPriceWithin2Hour
No description
> compute avg tick and avg sqrt price of pool within one hour from now


#### Declaration
```solidity
  function getAvgTickPriceWithin2Hour(
    address pool
  ) internal returns (int24 tick, uint160 sqrtPriceX96, int24 currTick, uint160 currSqrtPriceX96)
```

#### Modifiers:
No modifiers

#### Args:
| Arg | Type | Description |
| --- | --- | --- |
|`pool` | address | address of uniswap pool

#### Returns:
| Type | Description |
| --- | --- |
|`tick` | computed avg tick
|`sqrtPriceX96` | computed avg sqrt price, in the form of 96-bit fixed point number


