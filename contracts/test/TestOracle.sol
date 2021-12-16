// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "../libraries/UniswapOracle.sol";

contract TestOracle {
    function getAvgTickPriceWithin2Hour(address pool)
        external view
        returns (int24 tick, uint160 sqrtPriceX96, int24 currTick, uint160 currSqrtPriceX96) 
    {
        (tick, sqrtPriceX96, currTick, currSqrtPriceX96) = UniswapOracle.getAvgTickPriceWithin2Hour(pool);
    }
}