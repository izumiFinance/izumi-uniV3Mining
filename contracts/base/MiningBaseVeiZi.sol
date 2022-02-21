// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.4;

// Uncomment if needed.
// import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../libraries/FixedPoints.sol";
import "../libraries/Math.sol";
import "../uniswap/interfaces.sol";
import "../veiZi/interfaces.sol";
import "../multicall.sol";

/// @title Interface for WETH9
interface IWETH9 is IERC20 {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;
}

abstract contract MiningBaseVeiZi is Ownable, Multicall, ReentrancyGuard {

    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /// @dev Last block number that the accRewardRerShare is touched.
    uint256 public lastTouchBlock;

    /// @dev The block number when NFT mining rewards starts/ends.
    uint256 public startBlock;
    uint256 public endBlock;
    struct RewardInfo {
        /// @dev Contract of the reward erc20 token.
        address rewardToken;
        /// @dev who provides reward
        address provider;
        /// @dev Accumulated Reward Tokens per share, times Q128.
        uint256 accRewardPerShare;
        /// @dev Reward amount for each block.
        uint256 rewardPerBlock;
    }

    mapping(uint256 => RewardInfo) public rewardInfos;
    uint256 public rewardInfosLen;

    /// @dev Store the owner of the NFT token
    mapping(uint256 => address) public owners;
    /// @dev The inverse mapping of owners.
    mapping(address => EnumerableSet.UintSet) internal tokenIds;

    /// @notice Current total virtual liquidity.
    uint256 public totalVLiquidity;

    uint256 public totalValidVeiZi;

    /// @notice (1 - feeRemainPercent/100) is charging rate of uniswap fee
    uint24 public feeRemainPercent;

    uint256 public totalFeeCharged0;
    uint256 public totalFeeCharged1;


    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
    }

    PoolInfo public rewardPool;

    address public weth;

    address public chargeReceiver;

    /// @notice address of veiZi contract, address(0) for no boost
    address public veiZiAddress;

    /// @notice emit if user successfully deposit
    /// @param user user
    /// @param tokenId id of mining (same as uniswap nft token id)
    /// @param vLiquidity amount of vLiquidity in TokenStatus
    event Deposit(address indexed user, uint256 tokenId, uint256 vLiquidity);
    /// @notice emit if user successfully withdraw
    /// @param user user
    /// @param tokenId id of mining (same as uniswap nft token id)
    event Withdraw(address indexed user, uint256 tokenId);
    /// @notice emit if user successfully collect reward
    /// @param user user
    /// @param token address of reward erc-20 token
    /// @param amount amount of erc-20 token user received 
    event CollectReward(address indexed user, address token, uint256 amount);
    /// @notice emit if contract owner successfully calls modifyEndBlock(...)
    /// @param endBlock endBlock 
    event ModifyEndBlock(uint256 endBlock);
    /// @notice emit if contract owner successfully calls modifyRewardPerBlock(...)
    /// @param rewardToken address of reward erc20-token
    /// @param rewardPerBlock new reward per block of 'rewardToken'
    event ModifyRewardPerBlock(address indexed rewardToken, uint256 rewardPerBlock);
    /// @notice emit if contract owner successfully calls modifyProvider(...)
    /// @param rewardToken address of reward erc20-token
    /// @param provider New provider
    event ModifyProvider(address indexed rewardToken, address provider);

    bool normal;
    modifier checkNormal() {
        require(normal, "has emergency withrawed");
        _;
    }

    function _setRewardPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal {
        (rewardPool.token0, rewardPool.token1) = (tokenA < tokenB)? (tokenA, tokenB) : (tokenB, tokenA);
        rewardPool.fee = fee;
        totalFeeCharged0 = 0;
        totalFeeCharged1 = 0;
    }

    constructor(
        uint24 _feeChargePercent, address _uniV3NFTManager, address _veiZiAddress, address tokenA, address tokenB, uint24 fee, address _chargeReceiver, uint256 _totalValidVeiZi
    ) {
        require(_feeChargePercent <= 100, "charge percent <= 100");
        feeRemainPercent = 100 - _feeChargePercent;
        // mark weth erc token
        weth = INonfungiblePositionManager(_uniV3NFTManager).WETH9();
        // receiver to receive charged uniswap fee
        chargeReceiver = _chargeReceiver;
        veiZiAddress = _veiZiAddress;
        _setRewardPool(tokenA, tokenB, fee);

        totalValidVeiZi = _totalValidVeiZi; // start totalValidVeiZi cannot be 0, otherwise all validVeiZi will be 0
        normal = true;
    }

    /// @notice Transfers ETH to the recipient address
    /// @dev Fails with `STE`
    /// @param to The destination of the transfer
    /// @param value The value to be transferred
    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "STE");
    }

    function _safeTransferToken(address token, address to, uint256 value) internal {
        if (value > 0) {
            if (token == address(weth)) {
                IWETH9(token).withdraw(value);
                _safeTransferETH(to, value);
            } else {
                IERC20(token).safeTransfer(to, value);
            }
        }
    }

    /// @notice Update reward variables to be up-to-date.
    /// @param vLiquidity vLiquidity to add or minus
    /// @param isAdd add or minus
    function _updateVLiquidity(uint256 vLiquidity, bool isAdd) internal {
        if (isAdd) {
            totalVLiquidity = totalVLiquidity + vLiquidity;
        } else {
            totalVLiquidity = totalVLiquidity - vLiquidity;
        }

        // max lockBoostMultiplier is 3
        require(totalVLiquidity <= FixedPoints.Q128 * 3, "TOO MUCH LIQUIDITY STAKED");
    }

    /// @notice Update the global status.
    function _updateGlobalStatus() internal {
        if (block.number <= lastTouchBlock) {
            return;
        }
        if (lastTouchBlock >= endBlock) {
            return;
        }
        uint256 currBlockNumber = Math.min(block.number, endBlock);
        if (totalVLiquidity == 0) {
            lastTouchBlock = currBlockNumber;
            return;
        }

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            // tokenReward < 2^25 * 2^64 * 2*10, 15 years, 1000 r/block
            uint256 tokenReward = (currBlockNumber - lastTouchBlock) * rewardInfos[i].rewardPerBlock;
            // tokenReward * Q128 < 2^(25 + 64 + 10 + 128)
            rewardInfos[i].accRewardPerShare = rewardInfos[i].accRewardPerShare + ((tokenReward * FixedPoints.Q128) / totalVLiquidity);
        }
        lastTouchBlock = currBlockNumber;
    }

    struct UserStatus {
        // whether the UserStatus is inited
        bool inited;
        // total vLiquidity of the user's nft
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 veiZi;
        uint256 veStakingId;
        uint256 validVeiZi;
        uint256[] lastTouchAccRewardPerShare;
    }

    mapping(address => UserStatus) public userStatus;

    struct BoostInfo {
        uint256 oldValidVLiquidity;
        uint256 veStakingId;
        uint256 veiZi;
    }

    function _checkDoubleSpendingWithBoostInfo(UserStatus memory user, address userAddr) internal view returns(BoostInfo memory boostInfo) {
        if (veiZiAddress == address(0)) {
            boostInfo.veStakingId = 0;
            boostInfo.veiZi = 0;
            boostInfo.oldValidVLiquidity = user.validVLiquidity;
        } else {
            (, boostInfo.veStakingId, boostInfo.veiZi) = IVeiZi(veiZiAddress).stakingInfo(userAddr);
            if (user.veStakingId == 0) {
                // no boosting before, return origin validVLiquidity
                boostInfo.oldValidVLiquidity = user.validVLiquidity;
            } else if (boostInfo.veStakingId != user.veStakingId) {
                // double spending
                boostInfo.oldValidVLiquidity = user.vLiquidity * 4 / 10;
            } else {
                // veStakingId unchanged
                boostInfo.oldValidVLiquidity = user.validVLiquidity;
            }
        }
    }

    function _collectUserReward(address userAddr, bool noReward) internal {
        _updateGlobalStatus();
        UserStatus storage user = userStatus[userAddr];
        if (!user.inited) {
            // first time to access
            user.inited = true;
            user.lastTouchAccRewardPerShare = new uint256[](rewardInfosLen);
            for (uint256 i = 0; i < rewardInfosLen; i ++) {
                user.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
            }
        }
        if (user.vLiquidity == 0) {
            for (uint256 i = 0; i < rewardInfosLen; i ++) {
                user.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
            }
        }
        BoostInfo memory boostInfo = _checkDoubleSpendingWithBoostInfo(user, userAddr);

        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            // note we use oldValidVLiquidity to prevent double spending of veiZi
            uint256 tokenReward = (rewardInfos[i].accRewardPerShare - user.lastTouchAccRewardPerShare[i]) * boostInfo.oldValidVLiquidity / FixedPoints.Q128;
            if (tokenReward > 0 && !noReward) {
                IERC20(rewardInfos[i].rewardToken).safeTransferFrom(
                    rewardInfos[i].provider,
                    msg.sender,
                    tokenReward
                );
                emit CollectReward(
                    msg.sender,
                    rewardInfos[i].rewardToken,
                    tokenReward
                );
            }
            user.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }

        user.validVLiquidity = boostInfo.oldValidVLiquidity;
        user.veiZi = boostInfo.veiZi;
        user.veStakingId = boostInfo.veStakingId;

        user.validVeiZi = _updateTotalAndComputeValidVeiZi(user.validVeiZi, user.veiZi, user.vLiquidity);
        user.validVLiquidity = _computeValidVLiquidity(user.vLiquidity, user.veiZi);

    }

    /// @notice compute validVeiZi and update totalValidVeiZi, this function must be called after totalVLiquidity updated
    /// @dev totalValidVeiZi will be updated
    /// @param originValidVeiZi origin validVeiZi, 0 if newly deposit
    /// @param veiZi veiZi of this user queried from veiZi contract
    /// @param vLiquidity vLiquidity of mining
    /// @return validVeiZi computed validVeiZi for this mining
    function _updateTotalAndComputeValidVeiZi(uint256 originValidVeiZi, uint256 veiZi, uint256 vLiquidity) internal returns(uint256 validVeiZi) {
        totalValidVeiZi -= originValidVeiZi;
        if (totalVLiquidity == 0) {
            validVeiZi = 0;
        } else {
            // note vLiquidity < Q128
            validVeiZi = Math.min(veiZi, 2 * totalValidVeiZi * vLiquidity / totalVLiquidity);
            totalValidVeiZi += validVeiZi;
        }
    }

    /// @notice compute validVLiquidity
    /// @param vLiquidity origin vLiquidity
    /// @param veiZi amount of user's veiZi
    function _computeValidVLiquidity(uint256 vLiquidity, uint256 veiZi) internal virtual view returns (uint256 validVLiquidity) {
        if (totalValidVeiZi == 0) {
            validVLiquidity = vLiquidity;
        } else {
            uint256 iZiVLiquidity = vLiquidity * 4 / 10 + totalVLiquidity * veiZi / totalValidVeiZi * 6 / 10;
            validVLiquidity = Math.min(iZiVLiquidity, vLiquidity);
        }
    }

    /// @notice View function to get position ids staked here for an user.
    /// @param _user The related address.
    /// @return list of tokenId
    function getTokenIds(address _user)
        external
        view
        returns (uint256[] memory)
    {
        EnumerableSet.UintSet storage ids = tokenIds[_user];
        // push could not be used in memory array
        // we set the tokenIdList into a fixed-length array rather than dynamic
        uint256[] memory tokenIdList = new uint256[](ids.length());
        for (uint256 i = 0; i < ids.length(); i++) {
            tokenIdList[i] = ids.at(i);
        }
        return tokenIdList;
    }
    
    /// @notice Return reward multiplier over the given _from to _to block.
    /// @param _from The start block.
    /// @param _to The end block.
    function _getRewardBlockNum(uint256 _from, uint256 _to)
        internal
        view
        returns (uint256)
    {
        if (_from > _to) {
            return 0;
        }
        if (_to <= endBlock) {
            return _to - _from;
        } else if (_from >= endBlock) {
            return 0;
        } else {
            return endBlock - _from;
        }
    }

    /// @notice View function to see pending Rewards for an address.
    /// @param userAddr The related address.
    /// @return list of pending reward amount for each reward ERC20-token of this user
    function pendingRewards(address userAddr)
        public
        view
        returns (uint256[] memory)
    {
        uint256[] memory _reward = new uint256[](rewardInfosLen);
        UserStatus memory user = userStatus[userAddr];
        if (user.vLiquidity == 0) {
            for (uint256 i = 0; i < rewardInfosLen; i ++) {
                _reward[i] = 0;
            }
            return _reward;
        }
        BoostInfo memory boostInfo = _checkDoubleSpendingWithBoostInfo(user, userAddr);
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            uint256 globalReward = _getRewardBlockNum(
                lastTouchBlock,
                block.number
            ) * rewardInfos[i].rewardPerBlock;
            uint256 globalRewardPerShare = rewardInfos[i].accRewardPerShare + (globalReward * FixedPoints.Q128) / totalVLiquidity;
            // here we use boostInfo.oldValidVLiquidity to prevent double spending of veiZi
            _reward[i] = (globalRewardPerShare - user.lastTouchAccRewardPerShare[i]) * boostInfo.oldValidVLiquidity / FixedPoints.Q128;
        }
        return _reward;
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked assets
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external virtual;

    /// @notice Set new reward end block.
    /// @param _endBlock New end block.
    function modifyEndBlock(uint256 _endBlock) external onlyOwner {
        require(_endBlock > block.number, "OUT OF DATE");
        _updateGlobalStatus();
        // jump if origin endBlock < block.number
        lastTouchBlock = block.number;
        endBlock = _endBlock;
        emit ModifyEndBlock(endBlock);
    }

    /// @notice Set new reward per block.
    /// @param rewardIdx which rewardInfo to modify
    /// @param _rewardPerBlock new reward per block
    function modifyRewardPerBlock(uint256 rewardIdx, uint256 _rewardPerBlock)
        external
        onlyOwner
    {
        require(rewardIdx < rewardInfosLen, "OUT OF REWARD INFO RANGE");
        _updateGlobalStatus();
        rewardInfos[rewardIdx].rewardPerBlock = _rewardPerBlock;
        emit ModifyRewardPerBlock(
            rewardInfos[rewardIdx].rewardToken,
            _rewardPerBlock
        );
    }


    /// @notice Set new reward provider.
    /// @param rewardIdx which rewardInfo to modify
    /// @param provider New provider
    function modifyProvider(uint256 rewardIdx, address provider)
        external
        onlyOwner
    {
        require(rewardIdx < rewardInfosLen, "OUT OF REWARD INFO RANGE");
        rewardInfos[rewardIdx].provider = provider;
        emit ModifyProvider(rewardInfos[rewardIdx].rewardToken, provider);
    }

    function modifyChargeReceiver(address _chargeReceiver) external onlyOwner {
        chargeReceiver = _chargeReceiver;
    }

    function collectFeeCharged() external nonReentrant {
        require(msg.sender == chargeReceiver, "NOT RECEIVER");
        _safeTransferToken(rewardPool.token0, chargeReceiver, totalFeeCharged0);
        _safeTransferToken(rewardPool.token1, chargeReceiver, totalFeeCharged1);
        totalFeeCharged0 = 0;
        totalFeeCharged1 = 0;
    }
}