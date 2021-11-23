pragma solidity ^0.8.4;

library Math {
    function min(uint256 a, uint256 b) internal pure returns(uint256 c) {
        c = a;
        if (c > b) {
            c = b;
        }
    }
    function max(uint256 a, uint256 b) internal pure returns(uint256 c) {
        c = a;
        if (c < b) {
            c = b;
        }
    }
    function min(int24 a, int24 b) internal pure returns(int24 c) {
        c = a;
        if (c > b) {
            c = b;
        }
    }
    function max(int24 a, int24 b) internal pure returns(int24 c) {
        c = a;
        if (c < b) {
            c = b;
        }
    }
}