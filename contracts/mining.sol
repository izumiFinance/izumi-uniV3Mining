//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interface/INonfungiblePositionManager.sol";


contract Mining {
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _itemNum;

    address tokenAddress; // contract address of reward erc20 token
    address uniV3NFTAddress; // contract address of uniV3 NFT
    address uniV3NFTManagerAddress; // contract addres of uniV3 NFT Manager

    // the reward range of this mining contract is [lowertick, uppertick]
    int24 upperTick;
    int24 lowerTick;

    uint256 lastRewardBlock;  // last block number that reward occurs
    uint256 accCakePerShare; // Accumulated CAKEs per share, times 1e12. See below.

    uint256 rewardPerBlock;

    struct Item {
        address owner;
        uint256 tokenId;
        bool retrieved;
    }

    mapping(uint256 => Item) private id2item;

    // Events
    event Deposit(address indexed user, uint256 tokenId, uint256 itemId);
    event Withdraw(address indexed user, uint256 tokenId, uint256 itemId);

    constructor(address _tokenAddress, address _uniV3NFTAddress, address _token0, address _token1) {
        require(_token0 != _token1);
        (address token0, address token1) = _token0 < _token1 ? (_token0, _token1) : (_token1, _token0);
        
        tokenAddress = _tokenAddress;
        uniV3NFTAddress = _uniV3NFTAddress;
    }

    function getAmountForNFT(uint256 tokenId) public returns (uint256 amount) {
        // the ID of the pool with which this token is connected
        uint80 poolId;
        // the tick range of the position
        int24 tickLower;
        int24 tickUpper;
        // the liquidity of the position
        uint128 liquidity;

        (,, poolId, tickLower, tickUpper, liquidity,,,,) = INonfungiblePositionManager(uniV3NFTManagerAddress).positions(tokenId);
        amount = max(min(upperTick, tickUpper) - max(lowerTick,tickLower), 0) * liquidity;
        return amount;
    }

    function deposit(uint256 itemId) public returns (uint256 amount) {
        require(id2item[itemId].owner == msg.sender, "");
        IERC721(uniV3NFTAddress).transferFrom(msg.sender, address(this), id2item[itemId].tokenId);
        IERC20(tokenAddress).transferFrom(address(this), msg.sender, amount);
        return amount;
    }

    function withdraw(uint256 itemId) public {

        IERC721(uniV3NFTAddress).transferFrom(address(this), msg.sender, id2item[itemId].tokenId);
    }

    function pendingReward(address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[_user];
        uint256 accCakePerShare = pool.accCakePerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 cakeReward = multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accCakePerShare = accCakePerShare.add(cakeReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accCakePerShare).div(1e12).sub(user.rewardDebt);
    }

    function getReward(uint256 itemId) public {

    }

    function getRewardForAll() public {
    }
}
