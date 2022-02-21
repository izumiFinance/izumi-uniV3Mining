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
import "../libraries/Math.sol";
import "../libraries/UniswapCallingParams.sol";

import "../base/MiningBaseVeiZi.sol";


/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningFixRangeBoostVeiZi is MiningBaseVeiZi, IERC721Receiver {
    using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    address uniV3NFTManager;

    /// @dev The reward range of this mining contract.
    int24 rewardUpperTick;
    int24 rewardLowerTick;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 vLiquidity;
        uint256 lastTokensOwed0;
        uint256 lastTokensOwed1;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;

    struct PoolParams {
        address uniV3NFTManager;
        address token0;
        address token1;
        uint24 fee;
    }

    constructor(
        PoolParams memory poolParams,
        RewardInfo[] memory _rewardInfos,
        address _veiZiAddress,
        int24 _rewardUpperTick,
        int24 _rewardLowerTick,
        uint256 _startBlock,
        uint256 _endBlock,
        uint24 _feeChargePercent,
        address _chargeReceiver,
        uint256 _totalValidVeiZi
    ) MiningBaseVeiZi(
        _feeChargePercent, 
        poolParams.uniV3NFTManager, 
        _veiZiAddress, 
        poolParams.token0, 
        poolParams.token1, 
        poolParams.fee, 
        _chargeReceiver,
        _totalValidVeiZi
    ) {
        uniV3NFTManager = poolParams.uniV3NFTManager;

        require(_rewardLowerTick < _rewardUpperTick, "L<U");
        require(poolParams.token0 < poolParams.token1, "TOKEN0 < TOKEN1 NOT MATCH");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            rewardInfos[i].accRewardPerShare = 0;
        }

        rewardUpperTick = _rewardUpperTick;
        rewardLowerTick = _rewardLowerTick;

        startBlock = _startBlock;
        endBlock = _endBlock;

        lastTouchBlock = startBlock;

        totalVLiquidity = 0;

    }

    /// @notice Used for ERC721 safeTransferFrom
    function onERC721Received(address, address, uint256, bytes memory) 
        public 
        virtual 
        override 
        returns (bytes4) 
    {
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
            address veiZiAddress_,
            int24 rewardUpperTick_,
            int24 rewardLowerTick_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 totalValidVeiZi_,
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
            veiZiAddress,
            rewardUpperTick,
            rewardLowerTick,
            lastTouchBlock,
            totalVLiquidity,
            totalValidVeiZi,
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

    /// @notice Deposit a single position.
    /// @param tokenId The related position id.
    function deposit(uint256 tokenId)
        external checkNormal
        returns (uint256 vLiquidity)
    {
        address owner = INonfungiblePositionManager(uniV3NFTManager).ownerOf(tokenId);
        require(owner == msg.sender, "NOT OWNER");
        INonfungiblePositionManager.Position memory position;

        (
            ,
            ,
            position.token0,
            position.token1,
            position.fee,
            position.tickLower,
            position.tickUpper,
            position.liquidity,
            ,
            ,
            position.tokensOwed0,
            position.tokensOwed1
        ) = INonfungiblePositionManager(uniV3NFTManager).positions(tokenId);

        // alternatively we can compute the pool address with tokens and fee and compare the address directly
        require(position.token0 == rewardPool.token0, "TOEKN0 NOT MATCH");
        require(position.token1 == rewardPool.token1, "TOKEN1 NOT MATCH");
        require(position.fee == rewardPool.fee, "FEE NOT MATCH");

        // require the NFT token has interaction with [rewardLowerTick, rewardUpperTick]
        TokenStatus memory newTokenStatus;
        newTokenStatus.vLiquidity = _getVLiquidityForNFT(position.tickLower, position.tickUpper, position.liquidity);
        require(newTokenStatus.vLiquidity > 0, "INVALID TOKEN");

        INonfungiblePositionManager(uniV3NFTManager).safeTransferFrom(msg.sender, address(this), tokenId);
        owners[tokenId] = msg.sender;
        bool res = tokenIds[msg.sender].add(tokenId);
        require(res);

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        _collectUserReward(msg.sender, false);

        _updateVLiquidity(newTokenStatus.vLiquidity, true);
        UserStatus storage user = userStatus[msg.sender];
        user.vLiquidity += newTokenStatus.vLiquidity;
        user.validVeiZi = _updateTotalAndComputeValidVeiZi(user.validVeiZi, user.veiZi, user.vLiquidity);
        require(user.validVeiZi < FixedPoints.Q128 / 6, "veiZi O");
        user.validVLiquidity = _computeValidVLiquidity(user.vLiquidity, user.veiZi);
        
        newTokenStatus.lastTokensOwed0 = uint256(position.tokensOwed0);
        newTokenStatus.lastTokensOwed1 = uint256(position.tokensOwed1);
        tokenStatus[tokenId] = newTokenStatus;

        emit Deposit(msg.sender, tokenId, newTokenStatus.vLiquidity);
        return newTokenStatus.vLiquidity;
    }

    /// @notice withdraw a single position.
    /// @param tokenId The related position id.
    /// @param noReward true if donot collect reward
    function withdraw(uint256 tokenId, bool noReward) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");

        _collectUserReward(msg.sender, noReward || (!normal));
        TokenStatus memory t = tokenStatus[tokenId];

        _updateVLiquidity(t.vLiquidity, false);
        UserStatus storage user = userStatus[msg.sender];
        user.vLiquidity = user.vLiquidity - t.vLiquidity;
        user.validVeiZi = _updateTotalAndComputeValidVeiZi(user.validVeiZi, user.veiZi, user.vLiquidity);
        user.validVLiquidity = _computeValidVLiquidity(user.vLiquidity, user.veiZi);

        // charge and refund remain fee to user

        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(
            uniV3NFTManager
        ).collect(
            UniswapCallingParams.collectParams(tokenId, address(this))
        );

        uint256 lastTokensOwed0 = tokenStatus[tokenId].lastTokensOwed0;
        uint256 lastTokensOwed1 = tokenStatus[tokenId].lastTokensOwed1;

        uint256 refundAmount0 = lastTokensOwed0 + (amount0 - lastTokensOwed0) * feeRemainPercent / 100;
        uint256 refundAmount1 = lastTokensOwed1 + (amount1 - lastTokensOwed1) * feeRemainPercent / 100;
        _safeTransferToken(rewardPool.token0, msg.sender, refundAmount0);
        _safeTransferToken(rewardPool.token1, msg.sender, refundAmount1);
        totalFeeCharged0 += amount0 - refundAmount0;
        totalFeeCharged1 += amount1 - refundAmount1;

        INonfungiblePositionManager(uniV3NFTManager).safeTransferFrom(address(this), msg.sender, tokenId);
        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        emit Withdraw(msg.sender, tokenId);
    }


    /// @notice Collect all pending rewards.
    function collectRewards() external nonReentrant checkNormal {
        // owner of all token has been checked
        _collectUserReward(msg.sender, false);
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked iZi
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external override onlyOwner {
        address owner = owners[tokenId];
        require(owner != address(0));
        INonfungiblePositionManager(uniV3NFTManager).safeTransferFrom(
            address(this),
            owners[tokenId],
            tokenId
        );
        // make sure user cannot withdraw/depositIZI or collect reward on this nft
        owners[tokenId] = address(0);
        normal = false;
    }

}
