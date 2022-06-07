// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../iZiSwap/interfaces.sol";
import "./LogPowMath.sol";

library iZiSwapOracle {

    using iZiSwapOracle for address;

    struct Observation {
        uint32 blockTimestamp;
        int56 accPoint;
        bool initialized;
    }

    /// @dev query a certain observation from uniswap pool
    /// @param pool address of uniswap pool
    /// @param observationIndex index of wanted observation
    /// @return observation desired observation, see Observation to learn more
    function getObservation(address pool, uint observationIndex)
        internal
        view
        returns (Observation memory observation) 
    {
        (
            observation.blockTimestamp,
            observation.accPoint,
            observation.initialized
        ) = IiZiSwapPool(pool).observations(observationIndex);
    }

    /// @dev query latest and oldest observations from uniswap pool
    /// @param pool address of uniswap pool
    /// @param latestIndex index of latest observation in the pool
    /// @param observationCardinality size of observation queue in the pool
    /// @return oldestObservation
    /// @return latestObservation
    function getObservationBoundary(address pool, uint16 latestIndex, uint16 observationCardinality)
        internal
        view
        returns (Observation memory oldestObservation, Observation memory latestObservation)
    {
        uint16 oldestIndex = (latestIndex + 1) % observationCardinality;
        oldestObservation = pool.getObservation(oldestIndex);
        if (!oldestObservation.initialized) {
            oldestIndex = 0;
            oldestObservation = pool.getObservation(0);
        }
        if (latestIndex == oldestIndex) {
            // oldest observation is latest observation
            latestObservation = oldestObservation;
        } else {
            latestObservation = pool.getObservation(latestIndex);
        }
    }

    struct State {
        int24 currentPoint;
        uint160 sqrtPrice_96;
        uint16 observationCurrentIndex;
        uint16 observationQueueLen;
        uint16 observationNextQueueLen;
    }

    function getState(address pool) 
        internal
        view
        returns (State memory state) {
        (
            uint160 sqrtPrice_96,
            int24 currentPoint,
            uint16 observationCurrentIndex,
            uint16 observationQueueLen,
            uint16 observationNextQueueLen,
            ,
            ,
        ) = IiZiSwapPool(pool).state();
        state.currentPoint = currentPoint;
        state.sqrtPrice_96 = sqrtPrice_96;
        state.observationCurrentIndex = observationCurrentIndex;
        state.observationQueueLen = observationQueueLen;
        state.observationNextQueueLen = observationNextQueueLen;
    }

    // note if we call this interface, we must ensure that the 
    //    oldest observation preserved in pool is older than 2h ago
    function _getAvgTickFromTarget(address pool, uint32 targetTimestamp, int56 latestAccPoint, uint32 latestTimestamp)
        private
        view
        returns (int24 point) 
    {
        uint32[] memory secondsAgo = new uint32[](1);
        secondsAgo[0] = uint32(block.timestamp) - targetTimestamp;

        int56[] memory accPoints = IiZiSwapPool(pool).observe(secondsAgo);
        uint56 timeDelta = latestTimestamp - targetTimestamp;

        int56 pointAvg = (latestAccPoint - accPoints[0]) / int56(timeDelta);
        point = int24(pointAvg);
    }
    
    function getAvgPointPriceWithin2Hour(address pool)
        internal
        view
        returns (int24 point, uint160 sqrtPriceX96, int24 currentPoint, uint160 currSqrtPriceX96)
    {
        State memory state = pool.getState();

        if (state.observationQueueLen == 1) {
            // only 1 observation in the swap pool
            // we could simply return point/sqrtPrice of state
            return (state.currentPoint, state.sqrtPrice_96, state.currentPoint, state.sqrtPrice_96);
        } else {
            // we will search the latest observation and the observation 1h ago 

            // 1st, we should get the boundary of the observations in the pool
            Observation memory oldestObservation;
            Observation memory latestObservation;
            (oldestObservation, latestObservation) = pool.getObservationBoundary(state.observationCurrentIndex, state.observationQueueLen);
            
            if (oldestObservation.blockTimestamp == latestObservation.blockTimestamp) {
                // there is only 1 valid observation in the pool
                return (state.currentPoint, state.sqrtPrice_96, state.currentPoint, state.sqrtPrice_96);
            }
            uint32 twoHourAgo = uint32(block.timestamp - 7200);

            // now there must be at least 2 valid observations in the pool
            if (twoHourAgo <= oldestObservation.blockTimestamp || latestObservation.blockTimestamp <= oldestObservation.blockTimestamp + 3600) {
                // the oldest observation updated within 1h
                // we can not safely call IUniswapV3Pool.observe(...) for it 1h ago
                uint56 timeDelta = latestObservation.blockTimestamp - oldestObservation.blockTimestamp;
                int56 pointAvg = (latestObservation.accPoint - oldestObservation.accPoint) / int56(timeDelta);
                point = int24(pointAvg);
            } else {
                // we are sure that the oldest observation is old enough
                // we can safely call IUniswapV3Pool.observe(...) for it 1h ago
                uint32 targetTimestamp = twoHourAgo;
                if (targetTimestamp + 3600 > latestObservation.blockTimestamp) {
                    targetTimestamp = latestObservation.blockTimestamp - 3600;
                }
                point = _getAvgTickFromTarget(pool, targetTimestamp, latestObservation.accPoint, latestObservation.blockTimestamp);
            }
            sqrtPriceX96 = LogPowMath.getSqrtPrice(point);
            return (point, sqrtPriceX96, state.currentPoint, state.sqrtPrice_96);
        }
    }
}