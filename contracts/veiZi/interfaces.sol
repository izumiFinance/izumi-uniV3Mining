// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IVeiZi {
    
    function stakingInfo(address user)
        external
        view
        returns (
            uint256 nftId, 
            uint256 stakeId,
            uint256 amount
        );
    
}