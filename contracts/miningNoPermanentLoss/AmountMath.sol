pragma solidity ^0.8.4;

import "./FixedPoints.sol";
import "./MulDivMath.sol";
library AmountMath {
    function getAmount0ForLiquidity(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount0) {
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

        uint256 mulDivRes = MulDivMath.mulDivCeil(
            uint256(liquidity) << 96,
            sqrtRatioBX96 - sqrtRatioAX96,
            sqrtRatioBX96
        );
        amount0 = mulDivRes / sqrtRatioAX96;
        if (mulDivRes % sqrtRatioAX96 > 0) {
            amount0 ++;
        }
    }

    function getAmount1ForLiquidity(
        uint160 sqrtRatioAX96,
        uint160 sqrtRatioBX96,
        uint128 liquidity
    ) internal pure returns (uint256 amount1) {
        if (sqrtRatioAX96 > sqrtRatioBX96) (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);

        amount1 = MulDivMath.mulDivCeil(liquidity, sqrtRatioBX96 - sqrtRatioAX96, FixedPoints.Q96);
    }
}