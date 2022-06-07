// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../iZiSwap/interfaces.sol";
import "./Math.sol";

library iZiSwapCallingParams {
    function mintParams(
        address tokenX,
        address tokenY,
        uint24 fee,
        uint128 amountX,
        uint128 amountY,
        int24 leftPoint,
        int24 rightPoint,
        uint256 deadline
    )
        internal
        view
        returns (IiZiSwapLiquidityManager.MintParam memory params)
    {
        params.fee = fee;
        params.pl = leftPoint;
        params.pr = rightPoint;
        params.deadline = deadline;
        params.miner = address(this);
        params.amountXMin = 0;
        params.amountYMin = 0;
        if (tokenX < tokenY) {
            params.tokenX = tokenX;
            params.tokenY = tokenY;
            params.xLim = amountX;
            params.yLim = amountY;
        } else {
            params.tokenX = tokenY;
            params.tokenY = tokenX;
            params.xLim = amountY;
            params.yLim = amountX;
        }
    }
}