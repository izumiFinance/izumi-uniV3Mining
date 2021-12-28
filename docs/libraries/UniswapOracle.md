## `UniswapOracle`






### `getObservation(address pool, uint256 observationIndex) → struct UniswapOracle.Observation observation` (internal)



query a certain observation from uniswap pool


### `getObservationBoundary(address pool, uint16 latestIndex, uint16 observationCardinality) → struct UniswapOracle.Observation oldestObservation, struct UniswapOracle.Observation latestObservation` (internal)



query latest and oldest observations from uniswap pool


### `getSlot0(address pool) → struct UniswapOracle.Slot0 slot0` (internal)



view slot0 infomations from uniswap pool


### `getAvgTickPriceWithin2Hour(address pool) → int24 tick, uint160 sqrtPriceX96, int24 currTick, uint160 currSqrtPriceX96` (internal)



compute avg tick and avg sqrt price of pool within one hour from now




### `Observation`


uint32 blockTimestamp


int56 tickCumulative


uint160 secondsPerLiquidityCumulativeX128


bool initialized


### `Slot0`


int24 tick


uint160 sqrtPriceX96


uint16 observationIndex


uint16 observationCardinality


uint16 observationCardinalityNext



