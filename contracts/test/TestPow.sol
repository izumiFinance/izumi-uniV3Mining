// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.4;

import "../libraries/LogPowMath.sol";

contract TestPow {
    function getSqrtPrice(int24 point)
        external pure
        returns (uint160) 
    {
        return LogPowMath.getSqrtPrice(point);
    }
}