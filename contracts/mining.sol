//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interface/INonfungiblePositionManager.sol";


contract Mining {
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _itemNum;

    address LPTokenAddress; // contract address of reward erc20 token
    address rewardTokenAddress; // contract address of reward erc20 token
    address uniV3NFTManagerAddress; // contract addres of uniV3 NFT Manager
    address uniV3NFTAddress; // contract address of uniV3 NFT

    // the reward range of this mining contract is [lowertick, uppertick]
    int24 upperTick;
    int24 lowerTick;

    uint256 lastRewardBlock;  // last block number that reward occurs
    uint256 accTokenPerShare; // Accumulated Reward Tokens per share, times 1e12. See below.

    uint256 rewardPerBlock;
    uint256 totalAmount;

    // The block number when NFT mining starts.
    uint256 public startBlock;
    // The block number when NFT mining ends.
    uint256 public endBlock;

    struct Item {
        address owner;
        uint256 tokenId;
        bool exist;
    }

    mapping(uint256 => Item) private id2item;

    // Events
    event Deposit(address indexed user, uint256 tokenId, uint256 itemId);
    event Withdraw(address indexed user, uint256 tokenId, uint256 itemId);

    constructor(
        INonfungiblePositionManager _uniV3NFTManager,
        IERC721 _uniV3NFT,
        IERC20 _lpToken,
        IERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint _startBlock,
        uint _endBlock
    ) {
        uniV3NFTManager = _uniV3NFTManager;
        uniV3NFT = _uniV3NFT;

        lpToken = _lpToken;
        rewardToken = _rewardToken;

        rewardPerBlock = _rewardPerBlock;

        startBlock = _startBlock;
        endBlock = _endBlock;
        lastRewardBlock = startBlock;
        accTokenPerShare = 0;
        totalAmount = 0;
    }

    function getAmountForNFT(uint256 tokenId) view public returns (uint256 amount) {
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;

        (,, poolId, tickLower, tickUpper, liquidity,,,,) = INonfungiblePositionManager(uniV3NFTManagerAddress).positions(tokenId);
        amount = max(min(upperTick, tickUpper) - max(lowerTick,tickLower), 0) * liquidity;
        return amount;
    }

    // deposit NFT from user and returns according Reward tokens
    function deposit(uint256 tokenId) public returns (uint256 amount) {
        amount = getAmountForNFT(tokenId);
        require(amount > 0, "INVALID NFT");

        IERC721(uniV3NFTAddress).transferFrom(msg.sender, address(this), tokenId);
        _itemNum.increment();
        uint itemId = _itemNum.current();
        id2item[itemId] = Item(
            msg.sender,
            tokenId,
            true
        );
        
        updatePool(amount);

        IERC20(LPTokenAddress).transferFrom(address(this), msg.sender, amount);
        return amount;
    }

    // withdraw NFT and returns according Reward tokens
    function withdraw(uint256 itemId) public {
        require(id2item[itemId].owner == msg.sender, "NOT OWNER");
        require(id2item[itemId].exist == true, "NOT EXIST");

        amount = getAmountForNFT(id2item[itemId].tokenId);

        updatePool(-amount);

        IERC20(LPTokenAddress).transferFrom(msg.sender, address(this), amount);
        IERC721(uniV3NFTAddress).transferFrom(address(this), msg.sender, id2item[itemId].tokenId);
        delete id2item[itemId];
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

    // View function to see tokens from one user on frontend.
    function getNFTIdsForUser(address _user) view external returns (uint[] tokenIds) {
        uint[] tokenIds;
        for (uint i = 0; i < _itemNum.current(); i++) {
            if (id2item[i].retrieved) continue;
            if (id2item[i].owner == _user) {
                tokenIds.push(i);
            }
        }
        return tokenIds;
    }

    // View function to see pending Reward on frontend.
    function pendingReward(uint256 itemId) external view returns (uint256) {
        if (block.number > pool.lastRewardBlock && totalAmount != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 tokenReward = multiplier.mul(rewardPerBlock);
            accTokenPerShare = accTokenPerShare.add(cakeReward.mul(1e12).div(totalAmount));
        }
        return user.amount.mul(accCakePerShare).div(1e12).sub(user.rewardDebt);
    }

    // 
    function getReward(uint256 itemId) public {

    }

    // Update reward variables to be up-to-date.
    function updatePool(uint amount) public {
        if (block.number <= lastRewardBlock) {
            return;
        }
        if (totalAmount == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 tokenReward = multiplier.mul(rewardPerBlock);
        accTokenPerShare = accTokenPerShare.add(tokenReward.mul(1e12).div(totalAmount));
        // update new state
        totalAmount += amount;
        lastRewardBlock = block.number;
    }
}
