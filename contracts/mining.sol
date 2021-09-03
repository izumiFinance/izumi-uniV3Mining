//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./Trustable.sol";
import "./interface/INonfungiblePositionManager.sol";

library Math {
    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

contract Mining is Trustable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
    }

    PoolInfo public rewardPool;

    // contract of LP erc20 token
    // TODO: to use it
    IERC20 LPToken; 
    // contract of reward erc20 token
    IERC20 rewardToken; 

    // contract of uniV3 NFT Manager
    INonfungiblePositionManager uniV3NFTManager; 

    // the reward range of this mining contract.
    int24 rewardUpperTick;
    int24 rewardLowerTick;

    // Accumulated Reward Tokens per share, times 1e48.
    uint256 accRewardPerShare; 
    // last block number that the accRewardRerShare is touched
    uint256 lastTouchBlock;  

    uint256 rewardPerBlock;
    uint256 totalVLiquidity;

    // The block number when NFT mining starts/ends.
    uint256 public startBlock;
    uint256 public endBlock;

    // store the owner of the NFT token
    mapping(uint => address) public owners;
    mapping(uint => EnumerableSet.UintSet) private tokenIds;

    struct TokenStatus {
        uint256 vLiquidity;
        uint64 lastTouchBlock;
        uint256 lastTouchAccRewardPerShare;
    }

    // record the last time a certain token is touched 
    mapping(uint => TokenStatus) tokenStatus;

    // Events
    event Deposit(address indexed user, uint256 tokenId);
    event Withdraw(address indexed user, uint256 tokenId);
    event CollectReward(address indexed user, uint256 tokenId, uint256 amount);

    constructor(
        address _uniV3NFTManager,
        address _lpToken,
        address _rewardToken,
        uint256 _rewardPerBlock,
        uint _startBlock,
        uint _endBlock
    ) {
        uniV3NFTManager = INonfungiblePositionManager(_uniV3NFTManager);

        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);

        rewardPerBlock = _rewardPerBlock;

        startBlock = _startBlock;
        endBlock = _endBlock;
        lastTouchBlock = startBlock;
        accRewardPerShare = 0;
        totalVLiquidity = 0;
    }

    function getVLiquidityForNFT(
        int24 tickLower, 
        int24 tickUpper, 
        uint128 liquidity
    ) internal returns (uint256 vLiquidity) {
        vLiquidity = Math.max(Math.min(rewardUpperTick, tickUpper) - Math.max(rewardLowerTick,tickLower), 0) * liquidity;
        return vLiquidity;
    }

    function _updateTokenStatus(uint256 tokenId, uint vLiquidity) internal {
        TokenStatus t = tokenStatus[tokenId];
        if (vLiquidity > 0) {
            t.vLiquidity = vLiquidity;
        }
        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = accRewardPerShare; 
    }

    // Update reward variables to be up-to-date.
    function _updateVLiquidity(uint vLiquidity) internal {
        totalVLiquidity += vLiquidity;
        // TODO?
        // mint and send lp tokens to msg.sender
    }

    function _updateGlobalStatus() {
        if (lastTouchBlock >= block.number) {
            return;
        }

        // acc(T) = acc(T-N) + N * R * 1 / sum(L)
        uint256 multiplier = getMultiplier(lastTouchBlock, block.number);
        uint256 tokenReward = multiplier.mul(rewardPerBlock);
        accRewardPerShare = accRewardPerShare.add(tokenReward.mul(1e48).div(totalVLiquidity));
        lastTouchBlock = block.number;
    }

    function deposit(uint256 tokenId) public returns (uint256 vLiquidity) {
        (,, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity,,,,) = INonfungiblePositionManager(uniV3NFTManagerAddress).positions(tokenId);

        // alternatively we can compute the pool address with tokens and fee and compare the address directly
        require(token0 == rewardPool.token0);
        require(token1 == rewardPool.token1);
        require(fee == rewardPool.fee);

        vLiquidity = getAmountForNFT(tickLower, tickUpper, liquidity);
        require(vLiquidity > 0, "INVALID Token");

        uniV3NFTManager.transferFrom(msg.sender, address(this), tokenId);
        owners[tokenId] = msg.sender;
        tokenIds[msg.sender].add(tokenId);

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        _updateVLiquidity(vLiquidity);
        _updateTokenStatus(tokenId, vLiquidity);

        emit Deposit(msg.sender, tokenId);
        return vLiquidity;
    }

    function withdraw(uint256 tokenId) public {
        require(owners[tokenId] == msg.sender, "NOT OWNER");

        collectReward(tokenId);
        uint vLiquidity = tokenStatus[tokenId].vLiquidity;
        _updateVLiquidity(-vLiquidity);

        uniV3NFTManager.safeTransferFrom(address(this), msg.sender,tokenId);
        owners[tokenId] = address(0);
        tokenIds[msg.sender].remove(tokenId);

        emit Withdraw(msg.sender, tokenId);
    }

    function collectReward(uint256 tokenId) public {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        TokenStatus memory t = tokenStatus[tokenId];

        _updateGlobalStatus();

        // l * (currentAcc - lastAcc)
        uint _reward = t.vLiquidity.mul((accRewardPerShare.sub(t.lastTouchAccRewardPerShare)).div(1e48));
        require(_reward > 0);
        rewardToken.safeTransferFrom(address(this), msg.sender, _reward);
        _updateTokenStatus(tokenId, 0);

        emit collectReward(msg.sender, tokenId, _reward);
    }

    function collectRewards() public {
        EnumerableSet.UintSet memory ids = tokenIds[msg.sender];
        for (uint i = 0; i < ids.length(); i++) {
           colletReward(ids.at(i));
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= endBlock) {
            return _to.sub(_from);
        } else if (_from >= endBlock) {
            return 0;
        } else {
            return endBlock.sub(_from);
        }
    }


    // View function to see tokens from one user.
    function getTokenIds(address _user) view external returns (uint[] list) {
        uint [] list;
        EnumerableSet.UintSet memory ids = tokenIds[_user];

        for (uint i = 0; i < ids.length(); i++) {
            list.push(ids.at(i));
        }
        return list;
    }


    // View function to see pending Reward.
    function pendingReward(uint256 itemId) external view returns (uint256) {
        TokenStatus memory t = tokenStatus[tokenId];
        _updateGlobalStatus();
        // l * (currentAcc - lastAcc)
        uint _reward = t.vLiquidity.mul((accRewardPerShare.sub(t.lastTouchAccRewardPerShare)).div(1e48));
        return _reward;
    }

    // View function to see pending Reward.
    function pendingRewards(address _user) external view returns (uint256) {
        EnumerableSet.UintSet memory ids = tokenIds[_user];
        _updateGlobalStatus();
        uint _reward = 0;
        for (uint i = 0; i < ids.length(); i++) {
            TokenStatus memory t = tokenStatus[ids.at(i)];
            _reward += t.vLiquidity.mul((accRewardPerShare.sub(t.lastTouchAccRewardPerShare)).div(1e48));
        }

        return _reward;
    }
    
    // TODO: add control actions for the contract owner and operators
    // //

}