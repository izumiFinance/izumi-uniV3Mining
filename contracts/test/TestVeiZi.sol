// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

// import "hardhat/console.sol";

contract TestVeiZi {

    struct Staking {
        uint256 nftId;
        uint256 amount;
        uint256 end;
        uint256 stakingId;
    }

    uint256 public stakingNum = 0;
    
    mapping(address => Staking) public staking;
    uint256 public MAXTIME;

    constructor() {
        uint256 seconds4Year = 4 * 356 * 24 * 60 * 60;
        MAXTIME = seconds4Year / 14;
    }

    function stake(uint256 nftId, uint256 amount, uint256 end) external {
        stakingNum += 1;
        staking[msg.sender] = Staking({
            nftId: nftId,
            amount: amount,
            end: end,
            stakingId: stakingNum
        });
    }

    function max(uint256 a, uint256 b) public pure returns(uint256 c) {
        if (a < b) {
            return b;
        }
        return a;
    }

    function stakingInfo(address user) external view returns(uint256 nftId, uint256 stakingId, uint256 amount) {
        amount = staking[user].amount;
        uint256 end = staking[user].end;
        stakingId = staking[user].stakingId;
        nftId = staking[user].nftId;
        amount = amount / MAXTIME * (max(end, block.number) - block.number);
    }
}