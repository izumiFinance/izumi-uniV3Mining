// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.4;

// Uncomment if needed.
// import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import "../multicall.sol";

/// @title Simple math library for Max and Min.
library Math {
    function max(int24 a, int24 b) internal pure returns (int24) {
        return a >= b ? a : b;
    }

    function min(int24 a, int24 b) internal pure returns (int24) {
        return a < b ? a : b;
    }

    function max(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a : b;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

/// @title Uniswap V3 Nonfungible Position Manager Interface
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

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningFixRangeBoost is Ownable, Multicall, ReentrancyGuard, IERC721Receiver {
    using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
    }

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    PositionManagerV3 uniV3NFTManager;
    PoolInfo public rewardPool;

    /// @dev The reward range of this mining contract.
    int24 rewardUpperTick;
    int24 rewardLowerTick;

    /// @dev Last block number that the accRewardRerShare is touched.
    uint256 lastTouchBlock;

    /// @dev The block number when NFT mining rewards starts/ends.
    uint256 startBlock;
    uint256 endBlock;

    struct RewardInfo {
        /// @dev Contract of the reward erc20 token.
        address rewardToken;
        /// @dev who provides reward
        address provider;
        /// @dev Accumulated Reward Tokens per share, times 1e128.
        uint256 accRewardPerShare;
        /// @dev Reward amount for each block.
        uint256 rewardPerBlock;
    }

    mapping(uint256 => RewardInfo) public rewardInfos;
    uint256 public rewardInfosLen;

    /// @dev Store the owner of the NFT token
    mapping(uint256 => address) public owners;
    /// @dev The inverse mapping of owners.
    mapping(address => EnumerableSet.UintSet) private tokenIds;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
        uint256[] lastTouchAccRewardPerShare;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;

    function lastTouchAccRewardPerShare(uint256 tokenId)
        external
        view
        returns (uint256[] memory lta)
    {
        TokenStatus memory t = tokenStatus[tokenId];
        uint256 len = t.lastTouchAccRewardPerShare.length;
        lta = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            lta[i] = t.lastTouchAccRewardPerShare[i];
        }
        return lta;
    }

    /// @dev token to lock, 0 for not boost
    IERC20 public iziToken;
    /// @dev current total nIZI.
    uint256 public totalNIZI;

    /// @dev Current total virtual liquidity.
    uint256 public totalVLiquidity;

    /// @dev 2 << 128
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    // Events
    event Deposit(address indexed user, uint256 tokenId, uint256 nIZI);
    event Withdraw(address indexed user, uint256 tokenId);
    event CollectReward(
        address indexed user,
        uint256 tokenId,
        address token,
        uint256 amount
    );
    event ModifyEndBlock(uint256 endBlock);
    event ModifyRewardPerBlock(
        address indexed rewardToken,
        uint256 rewardPerBlock
    );
    event ModifyProvider(address indexed rewardToken, address provider);

    constructor(
        address _uniV3NFTManager,
        address token0,
        address token1,
        uint24 fee,
        RewardInfo[] memory _rewardInfos,
        address iziTokenAddr,
        int24 _rewardUpperTick,
        int24 _rewardLowerTick,
        uint256 _startBlock,
        uint256 _endBlock
    ) {
        uniV3NFTManager = PositionManagerV3(_uniV3NFTManager);
        require(_rewardLowerTick < _rewardUpperTick, "L<U");
        require(token0 < token1, "TOKEN0 < TOKEN1 NOT MATCH");
        rewardPool.token0 = token0;
        rewardPool.token1 = token1;
        rewardPool.fee = fee;

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            rewardInfos[i].accRewardPerShare = 0;
        }

        // iziTokenAddr == 0 means not boost
        iziToken = IERC20(iziTokenAddr);

        rewardUpperTick = _rewardUpperTick;
        rewardLowerTick = _rewardLowerTick;

        startBlock = _startBlock;
        endBlock = _endBlock;

        lastTouchBlock = startBlock;

        totalVLiquidity = 0;
        totalNIZI = 0;
    }
    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    /// @notice Get the overall info for the mining contract.
    function getMiningContractInfo()
        external
        view
        returns (
            address token0_,
            address token1_,
            uint24 fee_,
            RewardInfo[] memory rewardInfos_,
            address iziTokenAddr_,
            int24 rewardUpperTick_,
            int24 rewardLowerTick_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 startBlock_,
            uint256 endBlock_
        )
    {
        rewardInfos_ = new RewardInfo[](rewardInfosLen);
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos_[i] = rewardInfos[i];
        }
        return (
            rewardPool.token0,
            rewardPool.token1,
            rewardPool.fee,
            rewardInfos_,
            address(iziToken),
            rewardUpperTick,
            rewardLowerTick,
            lastTouchBlock,
            totalVLiquidity,
            startBlock,
            endBlock
        );
    }

    /// @notice Compute the virtual liquidity from a position's parameters.
    /// @param tickLower The lower tick of a position.
    /// @param tickUpper The upper tick of a position.
    /// @param liquidity The liquidity of a a position.
    /// @dev vLiquidity = liquidity * validRange^2 / 1e6, where the validRange is the tick amount of the
    /// intersection between the position and the reward range.
    /// We divided it by 1e6 to keep vLiquidity smaller than Q128 in most cases. This is safe since liqudity is usually a large number.
    function _getVLiquidityForNFT(
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal view returns (uint256 vLiquidity) {
        // liquidity is roughly equals to sqrt(amountX*amountY)
        require(liquidity >= 1e6, "LIQUIDITY TOO SMALL");
        uint256 validRange = uint24(
            Math.max(
                Math.min(rewardUpperTick, tickUpper) - Math.max(rewardLowerTick, tickLower),
                0
            )
        );
        vLiquidity = (validRange * validRange * uint256(liquidity)) / 1e6;
        return vLiquidity;
    }

    /// @notice new a token status when touched.
    function _newTokenStatus(
        uint256 tokenId,
        uint256 vLiquidity,
        uint256 validVLiquidity,
        uint256 nIZI
    ) internal {
        TokenStatus storage t = tokenStatus[tokenId];

        t.vLiquidity = vLiquidity;
        t.validVLiquidity = validVLiquidity;
        t.nIZI = nIZI;

        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = new uint256[](rewardInfosLen);
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            t.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }
    }

    /// @notice update a token status when touched
    function _updateTokenStatus(
        uint256 tokenId,
        uint256 vLiquidity,
        uint256 validVLiquidity,
        uint256 nIZI
    ) internal {
        TokenStatus storage t = tokenStatus[tokenId];

        t.vLiquidity = vLiquidity;
        // when not boost, validVL == vL
        t.validVLiquidity = validVLiquidity;
        t.nIZI = nIZI;

        t.lastTouchBlock = lastTouchBlock;
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            t.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }
    }

    /// @notice Update reward variables to be up-to-date.
    function _updateVLiquidity(uint256 vLiquidity, bool isAdd) internal {
        if (isAdd) {
            totalVLiquidity = totalVLiquidity + vLiquidity;
        } else {
            totalVLiquidity = totalVLiquidity - vLiquidity;
        }

        // Q128 is enough for 10^5 * 10^5 * 10^18 * 10^10
        require(totalVLiquidity <= Q128, "TOO MUCH LIQUIDITY STAKED");
    }

    function _updateNIZI(uint256 nIZI, bool isAdd) internal {
        if (isAdd) {
            totalNIZI = totalNIZI + nIZI;
        } else {
            totalNIZI = totalNIZI - nIZI;
        }

        // totalNIZI is always < Q96
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
            uint256 tokenReward = (currBlockNumber - lastTouchBlock) * rewardInfos[i].rewardPerBlock;
            rewardInfos[i].accRewardPerShare = rewardInfos[i].accRewardPerShare + ((tokenReward * Q128) / totalVLiquidity);
        }
        lastTouchBlock = currBlockNumber;
    }

    function _computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI)
        internal
        view
        returns (uint256)
    {
        if (totalNIZI == 0) {
            return vLiquidity;
        }
        uint256 iziVLiquidity = (vLiquidity * 4 + (totalVLiquidity * nIZI * 6) / totalNIZI) / 10;
        return Math.min(iziVLiquidity, vLiquidity);
    }

    /// @notice Deposit a single position.
    /// @param tokenId The related position id.
    /// @param nIZI the amount of izi to lock
    function deposit(uint256 tokenId, uint256 nIZI)
        external
        returns (uint256 vLiquidity)
    {
        address owner = uniV3NFTManager.ownerOf(tokenId);
        require(owner == msg.sender, "NOT OWNER");

        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,

        ) = uniV3NFTManager.positions(tokenId);

        // alternatively we can compute the pool address with tokens and fee and compare the address directly
        require(token0 == rewardPool.token0, "TOEKN0 NOT MATCH");
        require(token1 == rewardPool.token1, "TOKEN1 NOT MATCH");
        require(fee == rewardPool.fee, "FEE NOT MATCH");

        // require the NFT token has interaction with [rewardLowerTick, rewardUpperTick]
        vLiquidity = _getVLiquidityForNFT(tickLower, tickUpper, liquidity);
        require(vLiquidity > 0, "INVALID TOKEN");

        uniV3NFTManager.safeTransferFrom(msg.sender, address(this), tokenId);
        owners[tokenId] = msg.sender;
        bool res = tokenIds[msg.sender].add(tokenId);
        require(res);

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        _updateVLiquidity(vLiquidity, true);
        if (address(iziToken) == address(0)) {
            // boost is not enabled
            nIZI = 0;
        }
        _updateNIZI(nIZI, true);
        uint256 validVLiquidity = _computeValidVLiquidity(vLiquidity, nIZI);
        require(nIZI < Q128 / 6, "NIZI O");
        _newTokenStatus(tokenId, vLiquidity, validVLiquidity, nIZI);
        if (nIZI > 0) {
            // lock izi in this contract
            iziToken.safeTransferFrom(msg.sender, address(this), nIZI);
        }

        emit Deposit(msg.sender, tokenId, nIZI);
        return vLiquidity;
    }

    /// @notice deposit iZi to an nft token
    /// @param tokenId nft already deposited
    /// @param deltaNIZI amount of izi to deposit
    function depositIZI(uint256 tokenId, uint256 deltaNIZI)
        external
        nonReentrant
    {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");
        require(address(iziToken) != address(0), "NOT BOOST");
        require(deltaNIZI > 0, "DEPOSIT IZI MUST BE POSITIVE");
        _collectReward(tokenId);
        TokenStatus memory t = tokenStatus[tokenId];
        _updateNIZI(deltaNIZI, true);
        uint256 nIZI = t.nIZI + deltaNIZI;
        // update validVLiquidity
        uint256 validVLiquidity = _computeValidVLiquidity(t.vLiquidity, nIZI);
        _updateTokenStatus(tokenId, t.vLiquidity, validVLiquidity, nIZI);

        // transfer iZi from user
        iziToken.safeTransferFrom(msg.sender, address(this), deltaNIZI);
    }

    /// @notice withdraw a single position.
    /// @param tokenId The related position id.
    /// @param noReward true if donot collect reward
    function withdraw(uint256 tokenId, bool noReward) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");

        if (noReward) {
            _updateGlobalStatus();
        } else {
            _collectReward(tokenId);
        }
        uint256 vLiquidity = tokenStatus[tokenId].vLiquidity;
        _updateVLiquidity(vLiquidity, false);
        uint256 nIZI = tokenStatus[tokenId].nIZI;
        if (nIZI > 0) {
            _updateNIZI(nIZI, false);
            // refund iZi to user
            iziToken.safeTransfer(msg.sender, nIZI);
        }

        uniV3NFTManager.safeTransferFrom(address(this), msg.sender, tokenId);
        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        emit Withdraw(msg.sender, tokenId);
    }

    /// @notice Collect pending reward for a single position.
    /// @param tokenId The related position id.
    function _collectReward(uint256 tokenId) internal {
        TokenStatus memory t = tokenStatus[tokenId];

        _updateGlobalStatus();
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            uint256 _reward = (t.validVLiquidity * (rewardInfos[i].accRewardPerShare - t.lastTouchAccRewardPerShare[i])) / Q128;
            if (_reward > 0) {
                IERC20(rewardInfos[i].rewardToken).safeTransferFrom(
                    rewardInfos[i].provider,
                    msg.sender,
                    _reward
                );
            }
            emit CollectReward(
                msg.sender,
                tokenId,
                rewardInfos[i].rewardToken,
                _reward
            );
        }

        uint256 nIZI = t.nIZI;
        // update validVLiquidity
        uint256 validVLiquidity = _computeValidVLiquidity(t.vLiquidity, nIZI);
        _updateTokenStatus(tokenId, t.vLiquidity, validVLiquidity, nIZI);
    }

    /// @notice Collect pending reward for a single position.
    /// @param tokenId The related position id.
    function collectReward(uint256 tokenId) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");
        _collectReward(tokenId);
    }

    /// @notice Collect all pending rewards.
    function collectRewards() external nonReentrant {
        EnumerableSet.UintSet storage ids = tokenIds[msg.sender];
        for (uint256 i = 0; i < ids.length(); i++) {
            require(owners[ids.at(i)] == msg.sender, "NOT OWNER");
            _collectReward(ids.at(i));
        }
    }

    /// @notice View function to get position ids staked here for an user.
    /// @param _user The related address.
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
    function _getMultiplier(uint256 _from, uint256 _to)
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

    /// @notice View function to see pending Reward for a single position.
    /// @param tokenId The related position id.
    function pendingReward(uint256 tokenId)
        public
        view
        returns (uint256[] memory)
    {
        TokenStatus memory t = tokenStatus[tokenId];
        uint256[] memory _reward = new uint256[](rewardInfosLen);
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            uint256 multiplier = _getMultiplier(lastTouchBlock, block.number);
            uint256 tokenReward = multiplier * rewardInfos[i].rewardPerBlock;
            uint256 rewardPerShare = rewardInfos[i].accRewardPerShare + (tokenReward * Q128) / totalVLiquidity;
            // l * (currentAcc - lastAcc)
            _reward[i] = (t.validVLiquidity * (rewardPerShare - t.lastTouchAccRewardPerShare[i])) / Q128;
        }
        return _reward;
    }

    /// @notice View function to see pending Rewards for an address.
    /// @param _user The related address.
    function pendingRewards(address _user)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory _reward = new uint256[](rewardInfosLen);
        for (uint256 j = 0; j < rewardInfosLen; j++) {
            _reward[j] = 0;
        }

        for (uint256 i = 0; i < tokenIds[_user].length(); i++) {
            uint256[] memory r = pendingReward(tokenIds[_user].at(i));
            for (uint256 j = 0; j < rewardInfosLen; j++) {
                _reward[j] += r[j];
            }
        }
        return _reward;
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked iZi
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external onlyOwner {
        address owner = owners[tokenId];
        require(owner != address(0));
        uniV3NFTManager.safeTransferFrom(
            address(this),
            owners[tokenId],
            tokenId
        );
        uint256 nIZI = tokenStatus[tokenId].nIZI;
        if (nIZI > 0) {
            // we should ensure nft refund to user
            // omit the case when transfer() returns false unexpectedly
            iziToken.transfer(owner, nIZI);
        }
        // make sure user cannot withdraw/depositIZI or collect reward on this nft
        owners[tokenId] = address(0);
    }

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
}
