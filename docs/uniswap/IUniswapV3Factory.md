## `IUniswapV3Factory`






### `feeAmountTickSpacing(uint24 fee) → int24` (external)

Returns the tick spacing for a given fee amount, if enabled, or 0 if not enabled


A fee amount can never be removed, so this value should be hard coded or cached in the calling context


### `getPool(address tokenA, address tokenB, uint24 fee) → address pool` (external)

Returns the pool address for a given pair of tokens and a fee, or address 0 if it does not exist


tokenA and tokenB may be passed in either token0/token1 or token1/token0 order





