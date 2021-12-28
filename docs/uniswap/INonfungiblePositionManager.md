## `INonfungiblePositionManager`






### `factory() → address` (external)





### `WETH9() → address` (external)





### `positions(uint256 tokenId) → uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1` (external)





### `refundETH()` (external)

Refunds any ETH balance held by this contract to the `msg.sender`


Useful for bundling with mint or increase liquidity that uses ether, or exact output swaps
that use ether for the input amount

### `mint(struct INonfungiblePositionManager.MintParams params) → uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1` (external)

Creates a new position wrapped in a NFT


Call this when the pool does exist and is initialized. Note that if the pool is created but not initialized
a method does not exist, i.e. the pool is assumed to be initialized.


### `decreaseLiquidity(struct INonfungiblePositionManager.DecreaseLiquidityParams params) → uint256 amount0, uint256 amount1` (external)

Decreases the amount of liquidity in a position and accounts it to the position




### `collect(struct INonfungiblePositionManager.CollectParams params) → uint256 amount0, uint256 amount1` (external)

Collects up to a maximum amount of fees owed to a specific position to the recipient




### `safeTransferFrom(address from, address to, uint256 tokenId)` (external)





### `ownerOf(uint256 tokenId) → address` (external)





### `transferFrom(address from, address to, uint256 tokenId)` (external)







### `MintParams`


address token0


address token1


uint24 fee


int24 tickLower


int24 tickUpper


uint256 amount0Desired


uint256 amount1Desired


uint256 amount0Min


uint256 amount1Min


address recipient


uint256 deadline


### `DecreaseLiquidityParams`


uint256 tokenId


uint128 liquidity


uint256 amount0Min


uint256 amount1Min


uint256 deadline


### `CollectParams`


uint256 tokenId


address recipient


uint128 amount0Max


uint128 amount1Max



