// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../uniswap/interfaces.sol";
import "./Math.sol";

library UniswapCallingParams {
    // fill INonfungiblePositionManager.CollectParams struct to call INonfungiblePositionManager.collect(...)
    function collectParams(uint256 uniPositionID, address recipient)
        internal
        pure
        returns (INonfungiblePositionManager.CollectParams memory params)
    {
        params.tokenId = uniPositionID;
        params.recipient = recipient;
        params.amount0Max = 0xffffffffffffffffffffffffffffffff;
        params.amount1Max = 0xffffffffffffffffffffffffffffffff;
    }

    function decreaseLiquidityParams(
        uint256 uniPositionID,
        uint128 liquidity,
        uint256 deadline
    )
        internal
        pure
        returns (
            INonfungiblePositionManager.DecreaseLiquidityParams memory params
        )
    {
        params.tokenId = uniPositionID;
        params.liquidity = liquidity;
        params.amount0Min = 0;
        params.amount1Min = 0;
        params.deadline = deadline;
    }

    /// @dev fill INonfungiblePositionManager.MintParams struct to call INonfungiblePositionManager.mint(...)
    /// @param token0 one of token pair in uniswap pool, note here not necessary to ensure that token0 < token1
    /// @param token1 another token
    /// @param fee fee
    /// @param amount0 amount of token0
    /// @param amount1 amount of token1
    /// @param tickLeft tickLower
    /// @param tickRight tickUpper
    /// @param deadline deadline of mint calling
    /// @return params MintParams
    function mintParams(
        address token0,
        address token1,
        uint24 fee,
        uint256 amount0,
        uint256 amount1,
        int24 tickLeft,
        int24 tickRight,
        uint256 deadline
    )
        internal
        view
        returns (INonfungiblePositionManager.MintParams memory params)
    {
        params.fee = fee;
        params.tickLower = tickLeft;
        params.tickUpper = tickRight;
        params.deadline = deadline;
        params.recipient = address(this);
        params.amount0Min = 0;
        params.amount1Min = 0;
        if (token0 < token1) {
            params.token0 = token0;
            params.token1 = token1;
            params.amount0Desired = amount0;
            params.amount1Desired = amount1;
        } else {
            params.token0 = token1;
            params.token1 = token0;
            params.amount0Desired = amount1;
            params.amount1Desired = amount0;
        }
    }
}