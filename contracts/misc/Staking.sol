// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

import "../utils.sol";

interface IStaking {
    function token() external view returns(address);
    function accTokenPerShare() external view returns (uint256);
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _amount) external;
    function collect(address recipient, uint256 limit) external returns(uint256);
}
contract Staking is IStaking, Ownable {

    using SafeERC20 for IERC20;

    address public override token;
    address public tokenProvider;
    uint256 public tokenPerBlock;
    uint256 public startBlock;

    uint256 public override accTokenPerShare;
    uint256 public lastRewardBlock;
    uint256 public BONUS_MULTIPLIER = 1;

    uint256 public stakeAmount = 0;
    uint256 public accrualAmount = 0;
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pending;
    }

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    mapping (address => UserInfo) public userInfo;
    constructor(
        address miningToken,
        address miningTokenProvider,
        uint256 miningTokenPerBlock,
        uint256 miningStartBlock
    ) public {
        token = miningToken;
        tokenProvider = miningTokenProvider;
        tokenPerBlock = miningTokenPerBlock;
        startBlock = miningStartBlock;
        lastRewardBlock = startBlock;
    }
    function updateMultiplier(uint256 multiplierNumber) public onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return (_to - _from) * BONUS_MULTIPLIER;
    }
    function updatePool() public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        uint256 lpSupply = stakeAmount;
        if (lpSupply == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(lastRewardBlock, block.number);
        uint256 tokenReward = multiplier * tokenPerBlock;
        accrualAmount = accrualAmount + tokenReward;
        accTokenPerShare = accTokenPerShare + tokenReward * 1e12 / lpSupply;
        lastRewardBlock = block.number;
    }
    function _safeAccrualTransfer(address _to, uint256 _amount) private {
        IERC20(token).safeTransferFrom(tokenProvider, _to, _amount);
    }
    function deposit(uint256 _amount) external override {
        UserInfo storage user = userInfo[msg.sender];
        updatePool();
        if (user.amount > 0) {
            uint256 pending = user.amount * accTokenPerShare / 1e12 - user.rewardDebt;
            if(pending > 0) {
                user.pending = user.pending + pending;
            }
        }
        if(_amount > 0) {
            IERC20(token).safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount + _amount;
            stakeAmount = stakeAmount + _amount;
        }
        user.rewardDebt = user.amount * accTokenPerShare / 1e12;
        // _mint(msg.sender, _amount);
        emit Deposit(msg.sender, _amount);
    }
    function withdraw(uint256 _amount) external override {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: not enough!");
        updatePool();
        uint256 pending = user.amount * accTokenPerShare / 1e12 - user.rewardDebt;
        if(pending > 0) {
            user.pending = user.pending + pending;
        }
        if(_amount > 0) {
            user.amount = user.amount - _amount;
            stakeAmount = stakeAmount - _amount;
            user.pending = user.pending + _amount;
        }
        user.rewardDebt = user.amount * accTokenPerShare / 1e12;
        // _burn(msg.sender, _amount);
        emit Withdraw(msg.sender, _amount);
    }
    function collect(address recipient, uint256 limit) external override returns(uint256) {
        UserInfo storage user = userInfo[msg.sender];
        if (limit == 0) {
            limit = user.pending;
        }
        if (limit > user.pending) {
            limit = user.pending;
        }
        if (limit > 0) {
            user.pending -= limit;
            IERC20(token).safeTransferFrom(recipient, address(this), limit);
        }
        return limit;
    }
}