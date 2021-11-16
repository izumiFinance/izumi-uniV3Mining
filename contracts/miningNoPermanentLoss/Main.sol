pragma solidity ^0.8.4;
import "./utils.sol";
import "./Staking.sol";
import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";

contract Main is Ownable{

    using SafeBEP20 for IBEP20;
    
    mapping (address => address) public token2Staking;
    
    struct UserMiningInfo {
        address tokenStaking;
        address tokenUni;

        uint256 stakingAmount;
        uint256 stakingRewardDebt;
        uint256 stakingPending;

        uint256 uniStakingAmount;
        uint256 uniStakingRewardDebt;
        uint256 uniStakingAccuralPending;

        uint256 uniTokenID;
    }
    struct UniStakingPoolInfo {
        address tokenProvider;
        uint256 tokenPerBlock;
        uint256 startBlock;
        uint256 accTokenPerShare;
        uint256 lastRewardBlock;
        uint256 stakeAmount;
        uint256 BONUS_MULTPLIER;
        bool inited;
    }
    mapping (address => UniStakingPoolInfo) public uniStakingPoolInfo;
    mapping (address => address) public stakingPool;
    uint256 userMiningNum = 0;
    address weth;
    address nftManager;
    address uniFactory;

    mapping (uint256 => address) userMiningOwner;
    modifier checkMiningOwner(uint256 userMiningID) {
        require(userMiningOwner[userMiningID] == msg.sender, "Not Owner!");
        _;
    }

    function setUniStakingPoolInfo(
        address tokenUni,
        address tokenProvider,
        uint256 tokenPerBlock,
        uint256 startBlock,
        uint256 bonusMultiplier
    ) external onlyOwner {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[tokenUni];
        poolInfo.tokenProvider = tokenProvider;
        poolInfo.tokenPerBlock = tokenPerBlock;
        poolInfo.startBlock = startBlock;
        poolInfo.lastRewardBlock = startBlock;
        poolInfo.BONUS_MULTPLIER = bonusMultiplier;
        poolInfo.stakeAmount = 0;
        poolInfo.inited = true;
    }
    function setStakingPool(
        address token,
        address staking
    ) external onlyOwner {
        require(IStaking(staking).token() == token, "TKM");
        stakingPool[token] = staking;
    }
    function depositStaking(UserMiningInfo storage user, address staking, uint256 _amount) private {
        IStaking(staking).deposit(_amount);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if (pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (_amount > 0) {
            user.stakingAmount = user.stakingAmount + _amount;
        }
        user.stakingRewardDebt = user.stakingAmount * accTokenPerShare / 1e12;
    }
    function updateUniPool(UniStakingPoolInfo storage poolInfo) private {
        if (block.number <= poolInfo.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = poolInfo.stakeAmount;
        if (lpSupply == 0) {
            poolInfo.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = (block.number - poolInfo.lastRewardBlock) * poolInfo.BONUS_MULTPLIER;
        uint256 tokenReward = multiplier * poolInfo.tokenPerBlock;
        poolInfo.accTokenPerShare = poolInfo.accTokenPerShare + tokenReward * 1e12 / lpSupply;
        poolInfo.lastRewardBlock = block.number;
    }
    function depositUniStaking(UserMiningInfo storage user, uint256 _amount) private {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[user.tokenUni];
        updateUniPool(poolInfo);
        if (user.uniStakingAmount > 0) {
            uint256 pending = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12 - user.uniStakingRewardDebt;
            if (pending > 0) {
                user.uniStakingAccuralPending += pending;
            }
        }
        if (_amount > 0) {
            user.uniStakingAmount += _amount;
            poolInfo.stakeAmount += _amount;
        }
        user.uniStakingRewardDebt = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12;
    }
    function withdrawStaking(UserMiningInfo storage user, address staking, uint256 _amount) private {
        require(user.stakingAmount >= _amount, "withdraw: not enough!");
        IStaking(staking).withdraw(_amount);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if (pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (_amount > 0) {
            user.stakingAmount = user.stakingAmount - _amount;
            user.stakingPending = user.stakingPending + _amount;
        }
        user.stakingRewardDebt = user.stakingAmount * accTokenPerShare / 1e12;
    }
    function withdrawUniStaking(UserMiningInfo storage user, uint256 _amount) private {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[user.tokenUni];
        require(user.uniStakingAmount >= _amount, "withdraw: not enough!");
        updateUniPool(poolInfo);
        uint256 pending = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12 - user.uniStakingRewardDebt;
        if (pending > 0) {
            user.uniStakingAccuralPending += pending;
        }
        if (_amount > 0) {
            user.uniStakingAmount = user.uniStakingAmount - _amount;
            poolInfo.stakeAmount = poolInfo.stakeAmount - _amount;
            // we do not add _amount to uniStakingAccuralPending because _amount will be added in uniswap remainToken
        }
        user.uniStakingRewardDebt = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12;
    }
    function collectStaking(
        address recipient,
        UserMiningInfo storage user,
        address staking,
        uint256 limit
    ) private returns(uint256 collected) {
        IStaking(staking).withdraw(0);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if(pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (limit == 0) {
            limit = user.stakingPending;
        }
        if (limit > user.stakingPending) {
            limit = user.stakingPending;
        }
        collected = 0;
        if (limit > 0) {
            collected = IStaking(staking).collect(recipient, limit);
            user.stakingPending -= limit;
        }
    }
    function collectUniStaking(
        address recipient,
        UserMiningInfo storage user,
        uint256 limit
    ) private returns(uint256 collected) {
        withdrawUniStaking(user, 0);
        if (limit == 0) {
            limit = user.uniStakingAccuralPending;
        }
        if (limit > user.uniStakingAccuralPending) {
            limit = user.uniStakingAccuralPending;
        }
        collected = limit;
        if (collected > 0) {
            UniStakingPoolInfo poolInfo = uniStakingPoolInfo[user.tokenUni];
            address tokenUniProvider = poolInfo.tokenProvider;
            IBEP20(user.tokenUni).safeTransferFrom(tokenUniProvider, recipient, collected);
        }
    }
    function mint(
        address tokenUni,
        address tokenStaking,
        uint256 amountUni
    ) external payable {
        require(stakingPool[tokenStaking] != address(0), "No Staking Pool!");
        UniStakingPoolInfo storage uniPoolInfo = uniStakingPoolInfo[tokenUni];
        require(uniPoolInfo.inited, "No Uni Staking Pool!");
        
    }
}