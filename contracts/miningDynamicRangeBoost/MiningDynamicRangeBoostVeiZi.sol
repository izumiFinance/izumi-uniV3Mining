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

import "../libraries/UniswapOracle.sol";
import "../libraries/UniswapCallingParams.sol";

import "../base/MiningBaseVeiZi.sol";


/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningDynamicRangeBoostVeiZi is MiningBaseVeiZi {
    // using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    using UniswapOracle for address;

    int24 internal constant TICK_MAX = 500000;
    int24 internal constant TICK_MIN = -500000;

    int24 public tickRangeLeft;
    int24 public tickRangeRight;
    
    bool public token0IsETH;
    bool public token1IsETH;

    uint256 public totalToken0;
    uint256 public totalToken1;

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    address public uniV3NFTManager;
    address public uniFactory;
    address public swapPool;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 nftId;
        uint256 vLiquidity;
        uint256 uniLiquidity;
        uint256 lastTouchBlock;
        uint256 amount0;
        uint256 amount1;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;

    receive() external payable {}


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
        uint256 _startBlock,
        uint256 _endBlock,
        uint24 feeChargePercent,
        address _chargeReceiver,
        int24 _tickRangeLeft,
        int24 _tickRangeRight,
        uint256 _totalValidVeiZi
    ) MiningBaseVeiZi(
        feeChargePercent, 
        poolParams.uniV3NFTManager, 
        _veiZiAddress,
        poolParams.token0, 
        poolParams.token1, 
        poolParams.fee, 
        _chargeReceiver,
        _totalValidVeiZi
    ) {
        uniV3NFTManager = poolParams.uniV3NFTManager;

        require(rewardPool.token0 < rewardPool.token1, "TOKEN0 < TOKEN1 NOT MATCH");

        uniFactory = INonfungiblePositionManager(uniV3NFTManager).factory();

        // weth has been marked in the MiningBase constructor
        token0IsETH = (rewardPool.token0 == weth);
        token1IsETH = (rewardPool.token1 == weth);

        IERC20(rewardPool.token0).safeApprove(uniV3NFTManager, type(uint256).max);
        IERC20(rewardPool.token1).safeApprove(uniV3NFTManager, type(uint256).max);

        swapPool = IUniswapV3Factory(uniFactory).getPool(rewardPool.token0, rewardPool.token1, rewardPool.fee);
        require(swapPool != address(0), "NO UNI POOL");

        // check cardinality to prevent sandwitch attach
        require(UniswapOracle.getSlot0(swapPool).observationCardinalityNext >= 50, "CAR");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            // we could not believe accRewardPerShare from constructor args
            rewardInfos[i].accRewardPerShare = 0;
        }

        startBlock = _startBlock;
        endBlock = _endBlock;

        lastTouchBlock = startBlock;

        totalVLiquidity = 0;

        totalToken0 = 0;
        totalToken1 = 0;

        tickRangeLeft = _tickRangeLeft;
        tickRangeRight = _tickRangeRight;
    }

    /// @notice Get the overall info for the mining contract.
    function getMiningContractInfo()
        external
        view
        returns (
            address token0_,
            address token1_,
            uint24 fee_,
            address veiZiAddress_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 totalToken0_,
            uint256 totalToken1_,
            uint256 totalValidVeiZi_,
            uint256 startBlock_,
            uint256 endBlock_
        )
    {
        return (
            rewardPool.token0,
            rewardPool.token1,
            rewardPool.fee,
            veiZiAddress_,
            lastTouchBlock,
            totalVLiquidity,
            totalToken0,
            totalToken1,
            totalValidVeiZi,
            startBlock,
            endBlock
        );
    }

    /// @dev compute tick range converted from [oraclePrice / 2, oraclePrice * 2]
    /// @param stdTick, (tickLeft + tickRight) / 2 should not too differ from stdTick
    /// @return tickLeft
    /// @return tickRight
    function _getTickRange(int24 stdTick)
        private
        view
        returns (
            int24 tickLeft,
            int24 tickRight
        )
    {
        (int24 avgTick, , , ) = swapPool.getAvgTickPriceWithin2Hour();
        int56 delta = int56(avgTick) - int56(stdTick);
        delta = (delta >= 0) ? delta: -delta;
        require(delta < 2500, "TICK BIAS");
        // tickSpacing != 0 is ensured before deploy this contract
        int24 tickSpacing = IUniswapV3Factory(uniFactory).feeAmountTickSpacing(rewardPool.fee);
        // 1.0001^6932 = 2
        tickLeft = Math.max(avgTick - tickRangeLeft, TICK_MIN);
        tickRight = Math.min(avgTick + tickRangeRight, TICK_MAX);
        // round down to times of tickSpacing
        tickLeft = Math.tickFloor(tickLeft, tickSpacing);
        // round up to times of tickSpacing
        tickRight = Math.tickUpper(tickRight, tickSpacing);
        // double check
        require(tickLeft < tickRight, "L<R");
    }

    function getOraclePrice()
        external
        view
        returns (
            int24 avgTick,
            uint160 avgSqrtPriceX96
        )
    {
        (avgTick, avgSqrtPriceX96, , ) = swapPool.getAvgTickPriceWithin2Hour();
    }

    /// @notice Transfers ETH to the recipient address
    /// @dev Fails with `STE`
    /// @param to The destination of the transfer
    /// @param value The value to be transferred
    function safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "STE");
    }

    function _recvTokenFromUser(address token, address user, uint256 amount) private {
        if (amount == 0) {
            return;
        }
        if (token == weth) {
            // the other token must not be weth
            require(msg.value >= amount, "ETHER INSUFFICIENT");
        } else {
            // receive token(not weth) from user
            IERC20(token).safeTransferFrom(
                user,
                address(this),
                amount
            );
        }
    }

    function _refundTokenToUser(address token, address user, uint256 amount) private {
        if (amount == 0) {
            return;
        }
        if (token == weth) {
            // the other token must not be weth
            safeTransferETH(user, amount);
        } else {
            // for token not be weth
            IERC20(token).safeTransfer(
                user,
                amount
            );
        }
    }

    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        int24 stdTick
    ) external payable nonReentrant checkNormal {
        _recvTokenFromUser(rewardPool.token0, msg.sender, amount0Desired);
        _recvTokenFromUser(rewardPool.token1, msg.sender, amount1Desired);
        (int24 tickLeft, int24 tickRight) = _getTickRange(stdTick);

        TokenStatus memory newTokenStatus;

        INonfungiblePositionManager.MintParams
            memory uniParams = UniswapCallingParams.mintParams(
                rewardPool.token0, rewardPool.token1, rewardPool.fee, amount0Desired, amount1Desired, tickLeft, tickRight, type(uint256).max
            );
        uint256 actualAmount0; 
        uint256 actualAmount1;
        (
            newTokenStatus.nftId,
            newTokenStatus.uniLiquidity,
            actualAmount0,
            actualAmount1
        ) = INonfungiblePositionManager(uniV3NFTManager).mint{
            value: msg.value
        }(uniParams);

        require(newTokenStatus.uniLiquidity > 1e7, "liquidity too small!");
        newTokenStatus.vLiquidity = newTokenStatus.uniLiquidity / 1e6;

        totalToken0 += actualAmount0;
        totalToken1 += actualAmount1;
        newTokenStatus.amount0 = actualAmount0;
        newTokenStatus.amount1 = actualAmount1;

        // mark owners and append to list
        owners[newTokenStatus.nftId] = msg.sender;
        bool res = tokenIds[msg.sender].add(newTokenStatus.nftId);
        require(res);

        // refund tokens to user
        INonfungiblePositionManager(uniV3NFTManager).refundETH();
        if (actualAmount0 < amount0Desired) {
            _refundTokenToUser(rewardPool.token0, msg.sender, amount0Desired - actualAmount0);
        }
        if (actualAmount1 < amount1Desired) {
            _refundTokenToUser(rewardPool.token1, msg.sender, amount1Desired - actualAmount1);
        }

        _collectUserReward(msg.sender, false);

        _updateVLiquidity(newTokenStatus.vLiquidity, true);

        UserStatus storage user = userStatus[msg.sender];
        user.vLiquidity += newTokenStatus.vLiquidity;
        user.validVeiZi = _updateTotalAndComputeValidVeiZi(user.validVeiZi, user.veiZi, user.vLiquidity);
        require(user.validVeiZi < FixedPoints.Q128 / 6, "veiZi O");
        user.validVLiquidity = _computeValidVLiquidity(user.vLiquidity, user.veiZi);

        tokenStatus[newTokenStatus.nftId] = newTokenStatus;

        emit Deposit(msg.sender, newTokenStatus.nftId, newTokenStatus.vLiquidity);
    }

    /// @notice Widthdraw a single position.
    /// @param tokenId The related position id.
    /// @param noReward true if use want to withdraw without reward
    function withdraw(uint256 tokenId, bool noReward) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");

        _collectUserReward(msg.sender, noReward || (!normal));
        TokenStatus memory t = tokenStatus[tokenId];
        totalToken0 -= t.amount0;
        totalToken1 -= t.amount1;

        _updateVLiquidity(t.vLiquidity, false);
        UserStatus storage user = userStatus[msg.sender];
        user.vLiquidity = user.vLiquidity - t.vLiquidity;
        user.validVeiZi = _updateTotalAndComputeValidVeiZi(user.validVeiZi, user.veiZi, user.vLiquidity);
        user.validVLiquidity = _computeValidVLiquidity(user.vLiquidity, user.veiZi);

        // first charge and send remain fee from uniswap to user
        (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(
            uniV3NFTManager
        ).collect(
            UniswapCallingParams.collectParams(tokenId, address(this))
        );
        uint256 refundAmount0 = amount0 * feeRemainPercent / 100;
        uint256 refundAmount1 = amount1 * feeRemainPercent / 100;
        _safeTransferToken(rewardPool.token0, msg.sender, refundAmount0);
        _safeTransferToken(rewardPool.token1, msg.sender, refundAmount1);
        totalFeeCharged0 += amount0 - refundAmount0;
        totalFeeCharged1 += amount1 - refundAmount1;

        // then decrease and collect from uniswap
        INonfungiblePositionManager(uniV3NFTManager).decreaseLiquidity(
            UniswapCallingParams.decreaseLiquidityParams(tokenId, uint128(t.uniLiquidity), type(uint256).max)
        );
        (amount0, amount1) = INonfungiblePositionManager(
            uniV3NFTManager
        ).collect(
            UniswapCallingParams.collectParams(tokenId, address(this))
        );
        _safeTransferToken(rewardPool.token0, msg.sender, amount0);
        _safeTransferToken(rewardPool.token1, msg.sender, amount1);

        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        emit Withdraw(msg.sender, tokenId);
    }

    /// @notice Collect all pending rewards.
    function collectAllTokens() external nonReentrant checkNormal {
        // owner of all token has been checked
        _collectUserReward(msg.sender, false);
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked assets
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external override onlyOwner {
        address owner = owners[tokenId];
        require(owner != address(0));
        INonfungiblePositionManager(uniV3NFTManager).safeTransferFrom(
            address(this),
            owner,
            tokenId
        );

        // makesure user cannot withdraw/depositIZI or collect reward on this nft
        owners[tokenId] = address(0);
        normal = false;
    }

}
