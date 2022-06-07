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

import "../libraries/iZiSwapOracle.sol";
import "../libraries/iZiSwapCallingParams.sol";

import "../base/MiningBaseiZiSwap.sol";


/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningDynamicRangeiZiSwapV2 is MiningBaseiZiSwap {
    // using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    using iZiSwapOracle for address;

    int24 internal constant TICK_MAX = 500000;
    int24 internal constant TICK_MIN = -500000;

    int24 public pointRangeLeft;
    int24 public pointRangeRight;

    bool public tokenXIsETH;
    bool public tokenYIsETH;

    uint256 public totalTokenX;
    uint256 public totalTokenY;

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    address public iZiSwapLiquidityManager;
    address public iZiSwapFactory;
    address public swapPool;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 nftId;
        uint256 vLiquidity;
        uint256 iZiSwapLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
        uint256 amountX;
        uint256 amountY;
        uint256[] lastTouchAccRewardPerShare;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;

    receive() external payable {}

    // override for mining base
    function getBaseTokenStatus(uint256 tokenId) internal override view returns(BaseTokenStatus memory t) {
        TokenStatus memory ts = tokenStatus[tokenId];
        t = BaseTokenStatus({
            vLiquidity: ts.vLiquidity,
            validVLiquidity: ts.validVLiquidity,
            nIZI: ts.nIZI,
            lastTouchAccRewardPerShare: ts.lastTouchAccRewardPerShare
        });
    }

    struct PoolParams {
        address iZiSwapLiquidityManager;
        address tokenX;
        address tokenY;
        uint24 fee;
    }
    constructor(
        PoolParams memory poolParams,
        RewardInfo[] memory _rewardInfos,
        address iziTokenAddr,
        uint256 _startBlock,
        uint256 _endBlock,
        uint24 feeChargePercent,
        address _chargeReceiver,
        int24 _pointRangeLeft,
        int24 _pointRangeRight
    ) MiningBaseiZiSwap(feeChargePercent, poolParams.iZiSwapLiquidityManager, poolParams.tokenX, poolParams.tokenY, poolParams.fee, _chargeReceiver) {
        iZiSwapLiquidityManager = poolParams.iZiSwapLiquidityManager;

        require(rewardPool.tokenX < rewardPool.tokenY, "TOKEN0 < TOKEN1 NOT MATCH");

        iZiSwapFactory = IiZiSwapLiquidityManager(iZiSwapLiquidityManager).factory();

        // weth has been marked in the MiningBase constructor
        tokenXIsETH = (rewardPool.tokenX == weth);
        tokenYIsETH = (rewardPool.tokenY == weth);

        IERC20(rewardPool.tokenX).safeApprove(iZiSwapLiquidityManager, type(uint256).max);
        IERC20(rewardPool.tokenY).safeApprove(iZiSwapLiquidityManager, type(uint256).max);

        swapPool = IiZiSwapFactory(iZiSwapFactory).pool(rewardPool.tokenX, rewardPool.tokenY, rewardPool.fee);
        require(swapPool != address(0), "NO iZiSwap POOL");

        // check cardinality to prevent sandwitch attach
        require(iZiSwapOracle.getState(swapPool).observationNextQueueLen >= 50, "CAR");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            // we could not believe accRewardPerShare from constructor args
            rewardInfos[i].accRewardPerShare = 0;
        }

        // iziTokenAddr == 0 means not boost
        iziToken = IERC20(iziTokenAddr);

        startBlock = _startBlock;
        endBlock = _endBlock;

        lastTouchBlock = startBlock;

        totalVLiquidity = 0;
        totalNIZI = 0;

        totalTokenX = 0;
        totalTokenY = 0;

        pointRangeLeft = _pointRangeLeft;
        pointRangeRight = _pointRangeRight;
    }

    /// @notice Get the overall info for the mining contract.
    function getMiningContractInfo()
        external
        view
        returns (
            address tokenX_,
            address tokenY_,
            uint24 fee_,
            address iziTokenAddr_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 totalTokenX_,
            uint256 totalTokenY_,
            uint256 totalNIZI_,
            uint256 startBlock_,
            uint256 endBlock_
        )
    {
        return (
            rewardPool.tokenX,
            rewardPool.tokenY,
            rewardPool.fee,
            address(iziToken),
            lastTouchBlock,
            totalVLiquidity,
            totalTokenX,
            totalTokenY,
            totalNIZI,
            startBlock,
            endBlock
        );
    }

    /// @notice new a token status when touched.
    function _newTokenStatus(TokenStatus memory newTokenStatus) internal {
        tokenStatus[newTokenStatus.nftId] = newTokenStatus;
        TokenStatus storage t = tokenStatus[newTokenStatus.nftId];

        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = new uint256[](rewardInfosLen);
        // prevent user collect reward generated before creating this token status
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            t.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }
    }

    /// @notice update a token status when touched
    function _updateTokenStatus(
        uint256 tokenId,
        uint256 validVLiquidity,
        uint256 nIZI
    ) internal override {
        TokenStatus storage t = tokenStatus[tokenId];

        // when not boost, validVL == vL
        t.validVLiquidity = validVLiquidity;
        t.nIZI = nIZI;

        t.lastTouchBlock = lastTouchBlock;
        // prevent double collect
        for (uint256 i = 0; i < rewardInfosLen; i++) {
            t.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }
    }

    function _computeValidVLiquidity(uint256 vLiquidity, uint256 nIZI)
        internal override
        view
        returns (uint256)
    {
        if (totalNIZI == 0) {
            return vLiquidity;
        }
        uint256 iziVLiquidity = (vLiquidity * 4 + (totalVLiquidity * nIZI * 6) / totalNIZI) / 10;
        return Math.min(iziVLiquidity, vLiquidity);
    }

    /// @dev compute point range converted from [oraclePrice / 2, oraclePrice * 2]
    /// @param stdPoint, (leftPoint + rightPoint) / 2 should not too differ from stdPoint
    /// @return leftPoint
    /// @return rightPoint
    function _getPointRange(int24 stdPoint)
        private
        view
        returns (
            int24 leftPoint,
            int24 rightPoint
        )
    {
        (int24 avgPoint, , , ) = swapPool.getAvgPointPriceWithin2Hour();
        int56 delta = int56(avgPoint) - int56(stdPoint);
        delta = (delta >= 0) ? delta: -delta;
        require(delta < 2500, "TICK BIAS");
        // pointSpacing != 0 is ensured before deploy this contract
        int24 pointDelta = IiZiSwapFactory(iZiSwapFactory).fee2pointDelta(rewardPool.fee);

        leftPoint = Math.max(avgPoint - pointRangeLeft, TICK_MIN);
        rightPoint = Math.min(avgPoint + pointRangeRight, TICK_MAX);
        // round down to times of pointDelta
        leftPoint = Math.tickFloor(leftPoint, pointDelta);
        // round up to times of pointDelta
        rightPoint = Math.tickUpper(rightPoint, pointDelta);
        // double check
        require(leftPoint < rightPoint, "L<R");
    }

    function getOraclePrice()
        external
        view
        returns (
            int24 avgPoint,
            uint160 avgSqrtPriceX96
        )
    {
        (avgPoint, avgSqrtPriceX96, , ) = swapPool.getAvgPointPriceWithin2Hour();
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

    function deposit(
        uint128 amountXDesired,
        uint128 amountYDesired,
        uint256 numIZI,
        int24 stdPoint
    ) external payable nonReentrant {
        _recvTokenFromUser(rewardPool.tokenX, msg.sender, amountXDesired);
        _recvTokenFromUser(rewardPool.tokenY, msg.sender, amountYDesired);
        (int24 leftPoint, int24 rightPoint) = _getPointRange(stdPoint);

        TokenStatus memory newTokenStatus;

        IiZiSwapLiquidityManager.MintParam
            memory mintParam = iZiSwapCallingParams.mintParams(
                rewardPool.tokenX, rewardPool.tokenY, rewardPool.fee, amountXDesired, amountYDesired, leftPoint, rightPoint, type(uint256).max
            );
        uint256 actualAmountX; 
        uint256 actualAmountY;
        (
            newTokenStatus.nftId,
            newTokenStatus.iZiSwapLiquidity,
            actualAmountX,
            actualAmountY
        ) = IiZiSwapLiquidityManager(iZiSwapLiquidityManager).mint{
            value: msg.value
        }(mintParam);

        require(newTokenStatus.iZiSwapLiquidity > 1e7, "liquidity too small!");
        newTokenStatus.vLiquidity = newTokenStatus.iZiSwapLiquidity / 1e6;

        totalTokenX += actualAmountX;
        totalTokenY += actualAmountY;
        newTokenStatus.amountX = actualAmountX;
        newTokenStatus.amountY = actualAmountY;

        // mark owners and append to list
        owners[newTokenStatus.nftId] = msg.sender;
        bool res = tokenIds[msg.sender].add(newTokenStatus.nftId);
        require(res);

        // refund tokens to user
        IiZiSwapLiquidityManager(iZiSwapLiquidityManager).refundETH();
        if (tokenXIsETH) {
            if (actualAmountX < msg.value) {
                safeTransferETH(msg.sender, msg.value - actualAmountX);
            }
        } else {
            if (actualAmountX < amountXDesired) {
                IERC20(rewardPool.tokenX).safeTransfer(msg.sender, amountXDesired - actualAmountX);
            }
        }
        if (tokenYIsETH) {
            if (actualAmountY < msg.value) {
                safeTransferETH(msg.sender, msg.value - actualAmountY);
            }
        } else {
            if (actualAmountY < amountYDesired) {
                IERC20(rewardPool.tokenY).safeTransfer(msg.sender, amountYDesired - actualAmountY);
            }
        }

        _updateGlobalStatus();

        _updateVLiquidity(newTokenStatus.vLiquidity, true);

        newTokenStatus.nIZI = numIZI;
        if (address(iziToken) == address(0)) {
            // boost is not enabled
            newTokenStatus.nIZI = 0;
        }
        _updateNIZI(newTokenStatus.nIZI, true);
        newTokenStatus.validVLiquidity = _computeValidVLiquidity(
            newTokenStatus.vLiquidity,
            newTokenStatus.nIZI
        );
        require(newTokenStatus.nIZI < FixedPoints.Q128 / 6, "NIZI O");
        _newTokenStatus(newTokenStatus);
        if (newTokenStatus.nIZI > 0) {
            // lock izi in this contract
            _recvTokenFromUser(address(iziToken), msg.sender, newTokenStatus.nIZI);
        }

        emit Deposit(msg.sender, newTokenStatus.nftId, newTokenStatus.nIZI);
    }

    /// @notice Widthdraw a single position.
    /// @param tokenId The related position id.
    /// @param noReward true if use want to withdraw without reward
    function withdraw(uint256 tokenId, bool noReward) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");

        if (noReward) {
            _updateGlobalStatus();
        } else {
            _collectReward(tokenId);
        }
        TokenStatus storage t = tokenStatus[tokenId];
        totalTokenX -= t.amountX;
        totalTokenY -= t.amountY;

        _updateVLiquidity(t.vLiquidity, false);
        if (t.nIZI > 0) {
            _updateNIZI(t.nIZI, false);
            // refund iZi to user
            iziToken.safeTransfer(msg.sender, t.nIZI);
        }

        // first charge and send remain fee from iZiSwap to user
        (uint256 amountX, uint256 amountY) = IiZiSwapLiquidityManager(
            iZiSwapLiquidityManager
        ).collect(
            address(this), tokenId, type(uint128).max, type(uint128).max
        );
        uint256 refundAmountX = amountX * feeRemainPercent / 100;
        uint256 refundAmountY = amountY * feeRemainPercent / 100;
        _safeTransferToken(rewardPool.tokenX, msg.sender, refundAmountX);
        _safeTransferToken(rewardPool.tokenY, msg.sender, refundAmountY);
        totalFeeChargedX += amountX - refundAmountX;
        totalFeeChargedY += amountY - refundAmountY;

        // then decrease and collect from iZiSwap
        IiZiSwapLiquidityManager(iZiSwapLiquidityManager).decLiquidity(
            tokenId, uint128(t.iZiSwapLiquidity), 0, 0, type(uint256).max
        );
        (amountX, amountY) = IiZiSwapLiquidityManager(
            iZiSwapLiquidityManager
        ).collect(
            address(this), tokenId, type(uint128).max, type(uint128).max
        );
        _safeTransferToken(rewardPool.tokenX, msg.sender, amountX);
        _safeTransferToken(rewardPool.tokenY, msg.sender, amountY);

        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        emit Withdraw(msg.sender, tokenId);
    }

    /// @notice Collect pending reward for a single position.
    /// @param tokenId The related position id.
    function collect(uint256 tokenId) external nonReentrant {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        _collectReward(tokenId);
        if (feeRemainPercent == 100) {
            // collect swap fee from iZiSwap
            IiZiSwapLiquidityManager(iZiSwapLiquidityManager).collect(msg.sender, tokenId, type(uint128).max, type(uint128).max);
        }
    }

    /// @notice Collect all pending rewards.
    function collectAllTokens() external nonReentrant {
        EnumerableSet.UintSet storage ids = tokenIds[msg.sender];
        for (uint256 i = 0; i < ids.length(); i++) {
            uint256 tokenId = ids.at(i);
            require(owners[tokenId] == msg.sender, "NOT OWNER");
            _collectReward(tokenId);
            if (feeRemainPercent == 100) {
                // collect swap fee from iZiSwap
                IiZiSwapLiquidityManager(iZiSwapLiquidityManager).collect(msg.sender, tokenId, type(uint128).max, type(uint128).max);
            }
        }
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked assets
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external override onlyOwner {
        address owner = owners[tokenId];
        require(owner != address(0));
        IiZiSwapLiquidityManager(iZiSwapLiquidityManager).safeTransferFrom(
            address(this),
            owner,
            tokenId
        );

        TokenStatus storage t = tokenStatus[tokenId];
        if (t.nIZI > 0) {
            // we should ensure nft refund to user
            // omit the case when transfer() returns false unexpectedly
            iziToken.transfer(owner, t.nIZI);
        }
        // makesure user cannot withdraw/depositIZI or collect reward on this nft
        owners[tokenId] = address(0);
    }

}
