//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./trustable.sol";

library Math {
    function max(int24 a, int24 b) internal pure returns (int24) {
        return a >= b ? a : b;
    }
    function min(int24 a, int24 b) internal pure returns (int24) {
        return a < b ? a : b;
    }
}

interface PositionManagerV3 {
    function positions(uint256 tokenId)
        external
        view
        returns (
            uint96 nonce,
            address operator,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        );
    function safeTransferFrom(address from, address to, uint tokenId) external;
    
    function ownerOf(uint tokenId) external view returns (address);
    function transferFrom(address from, address to, uint tokenId) external;
}

contract Mining is Trustable {
    using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

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
    PositionManagerV3 uniV3NFTManager; 

    // the reward range of this mining contract.
    int24 public rewardUpperTick;
    int24 public rewardLowerTick;

    // Accumulated Reward Tokens per share, times 1e48.
    uint256 accRewardPerShare; 
    // last block number that the accRewardRerShare is touched
    uint256 lastTouchBlock;  

    // reward tokens for each block
    uint256 rewardPerBlock;
    // current total virtual Liquidity
    uint256 totalVLiquidity;

    // The block number when NFT mining rewards starts/ends.
    uint256 public startBlock;
    uint256 public endBlock;

    // store the owner of the NFT token
    mapping(uint => address) public owners;
    mapping(address => EnumerableSet.UintSet) private tokenIds;

    struct TokenStatus {
        uint256 vLiquidity;
        uint256 lastTouchBlock;
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
        address token0,
        address token1,
        uint24 fee,
        address _rewardToken,
        uint256 _rewardPerBlock,
        int24 _rewardUpperTick,
        int24 _rewardLowerTick,
        uint _startBlock,
        uint _endBlock
    ) {
        uniV3NFTManager = PositionManagerV3(_uniV3NFTManager);

        // lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);

	    rewardPool.token0 = token0;
	    rewardPool.token1 = token1;
	    rewardPool.fee = fee;

        rewardPerBlock = _rewardPerBlock;

        rewardUpperTick = _rewardUpperTick;
        rewardLowerTick = _rewardLowerTick;

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
    ) internal view returns (uint256 vLiquidity) {
        vLiquidity = uint24(Math.max(Math.min(rewardUpperTick, tickUpper) - Math.max(rewardLowerTick,tickLower), 0)) * uint256(liquidity);
        return vLiquidity;
    }

    function _updateTokenStatus(uint256 tokenId, uint vLiquidity) internal {
        TokenStatus storage t = tokenStatus[tokenId];
        if (vLiquidity > 0) {
            t.vLiquidity = vLiquidity;
        }
        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = accRewardPerShare; 
    }

    // Update reward variables to be up-to-date.
    function _updateVLiquidity(uint vLiquidity, bool isAdd) internal {
        if (isAdd) {
            totalVLiquidity = totalVLiquidity + vLiquidity;
        } else {
            totalVLiquidity = totalVLiquidity + vLiquidity;
        }
        // TODO?
        // add total Liquidity limit?
        // mint and send lp tokens to msg.sender
    }

    function _updateGlobalStatus() internal {
        if (lastTouchBlock >= block.number) {
            return;
        }

        // acc(T) = acc(T-N) + N * R * 1 / sum(L)
        uint256 multiplier = getMultiplier(lastTouchBlock, block.number);
        uint256 tokenReward = multiplier * rewardPerBlock;
        accRewardPerShare = accRewardPerShare + (tokenReward * 1e48 / totalVLiquidity);
        lastTouchBlock = block.number;
    }

    function deposit(uint256 tokenId) public returns (uint256 vLiquidity) {
        (, address owner, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity,,,,) = uniV3NFTManager.positions(tokenId);
        require(owner == msg.sender, "NOT OWNER");

        // alternatively we can compute the pool address with tokens and fee and compare the address directly
        require(token0 == rewardPool.token0);
        require(token1 == rewardPool.token1);
        require(fee == rewardPool.fee);

        // require the NFT token has interaction with [rewardLowerTick, rewardUpperTick]
        vLiquidity = getVLiquidityForNFT(tickLower, tickUpper, liquidity);
        require(vLiquidity > 0, "INVALID Token");

        uniV3NFTManager.transferFrom(msg.sender, address(this), tokenId);
        owners[tokenId] = msg.sender;
        tokenIds[msg.sender].add(tokenId);

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        _updateVLiquidity(vLiquidity, true);
        _updateTokenStatus(tokenId, vLiquidity);

        emit Deposit(msg.sender, tokenId);
        return vLiquidity;
    }

    function withdraw(uint256 tokenId) public {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");

        collectReward(tokenId);
        uint vLiquidity = tokenStatus[tokenId].vLiquidity;
        _updateVLiquidity(vLiquidity, false);

        uniV3NFTManager.safeTransferFrom(address(this), msg.sender, tokenId);
        owners[tokenId] = address(0);
        tokenIds[msg.sender].remove(tokenId);

        emit Withdraw(msg.sender, tokenId);
    }

    function collectReward(uint256 tokenId) public {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        TokenStatus memory t = tokenStatus[tokenId];

        _updateGlobalStatus();

        // l * (currentAcc - lastAcc)
        uint _reward = t.vLiquidity * (accRewardPerShare - t.lastTouchAccRewardPerShare) / 1e48;
        require(_reward > 0);
        rewardToken.safeTransferFrom(address(this), msg.sender, _reward);
        _updateTokenStatus(tokenId, 0);

        emit CollectReward(msg.sender, tokenId, _reward);
    }

    function collectRewards() public {
        EnumerableSet.UintSet storage ids = tokenIds[msg.sender];
        for (uint i = 0; i < ids.length(); i++) {
           collectReward(ids.at(i));
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= endBlock) {
            return _to - _from;
        } else if (_from >= endBlock) {
            return 0;
        } else {
            return endBlock - _from;
        }
    }


    // View function to see tokens from one user.
    function getTokenIds(address _user) view external returns (uint[] memory) {
        EnumerableSet.UintSet storage ids = tokenIds[_user];
        // push could not be used in memory array
        // we set the tokenIdList into a fixed-length array rather than dynamic
        uint[] memory tokenIdList = new uint[](ids.length());
        for (uint i = 0; i < ids.length(); i++) {
            tokenIdList[i] = ids.at(i);
        }
        return tokenIdList;
    }


    // View function to see pending Reward.
    function pendingReward(uint256 itemId) external view returns (uint256) {
        TokenStatus memory t = tokenStatus[itemId];
        uint256 multiplier = getMultiplier(lastTouchBlock, block.number);
        uint256 tokenReward = multiplier * rewardPerBlock;
        uint256 rewardPerShare = accRewardPerShare + tokenReward * 1e48 / totalVLiquidity;
        // l * (currentAcc - lastAcc)
        uint _reward = t.vLiquidity * (rewardPerShare - t.lastTouchAccRewardPerShare) / 1e48;
        return _reward;
    }

    // View function to see pending Reward.
    function pendingRewards(address _user) external view returns (uint256) {
        uint256 multiplier = getMultiplier(lastTouchBlock, block.number);
        uint256 tokenReward = multiplier * rewardPerBlock;
        uint256 rewardPerShare = accRewardPerShare + tokenReward * 1e48 / totalVLiquidity;
        uint _reward = 0;
        for (uint i = 0; i < tokenIds[_user].length(); i++) {
            TokenStatus memory t = tokenStatus[tokenIds[_user].at(i)];
            _reward += t.vLiquidity * (rewardPerShare - t.lastTouchAccRewardPerShare) / 1e48;
        }

        return _reward;
    }
    
    // TODO: add control actions for the contract owner and operators
    // //
}
