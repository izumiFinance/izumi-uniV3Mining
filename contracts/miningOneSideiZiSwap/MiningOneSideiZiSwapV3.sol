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
contract MiningOneSideiZiSwapV3 is MiningBaseiZiSwap {
    // using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    using iZiSwapOracle for address;

    int24 internal constant TICK_MAX = 500000;
    int24 internal constant TICK_MIN = -500000;

    bool public oneSideIsETH;

    address public oneSideToken;
    address public lockToken;

    address public iZiSwapLiquidityManager;
    address public iZiSwapFactory;
    address public swapPool;

    uint256 public lockBoostMultiplier;
    /// @dev Current total lock token
    uint256 public totalLock;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 nftId;
        // bool isDepositWithNFT;
        uint128 iZiSwapLiquidity;
        uint256 lockAmount;
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
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
        address oneSideTokenAddr;
        address lockTokenAddr;
        uint24 fee;
    }

    constructor(
        PoolParams memory poolParams,
        RewardInfo[] memory _rewardInfos,
        uint256 _lockBoostMultiplier,
        address iziTokenAddr,
        uint256 _startBlock,
        uint256 _endBlock,
        uint24 feeChargePercent,
        address _chargeReceiver
    ) MiningBaseiZiSwap(
        feeChargePercent, 
        poolParams.iZiSwapLiquidityManager, 
        poolParams.oneSideTokenAddr,
        poolParams.lockTokenAddr,
        poolParams.fee, 
        _chargeReceiver
    ) {
        iZiSwapLiquidityManager = poolParams.iZiSwapLiquidityManager;
        // locking eth is not support
        require(weth != poolParams.lockTokenAddr, "WETH NOT SUPPORT");
        iZiSwapFactory = IiZiSwapLiquidityManager(iZiSwapLiquidityManager).factory();

        oneSideToken = poolParams.oneSideTokenAddr;

        oneSideIsETH = (oneSideToken == weth);
        lockToken = poolParams.lockTokenAddr;

        IERC20(oneSideToken).safeApprove(iZiSwapLiquidityManager, type(uint256).max);

        swapPool = IiZiSwapFactory(iZiSwapFactory).pool(
            lockToken,
            oneSideToken,
            poolParams.fee
        );
        require(swapPool != address(0), "NO UNI POOL");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            // we cannot believe accRewardPerShare from constructor params
            rewardInfos[i].accRewardPerShare = 0;
        }
        //  lock boost multiplier is at most 3
        require(_lockBoostMultiplier > 0, "M>0");
        require(_lockBoostMultiplier < 4, "M<4");

        lockBoostMultiplier = _lockBoostMultiplier;

        // iziTokenAddr == 0 means not boost
        iziToken = IERC20(iziTokenAddr);

        startBlock = _startBlock;
        endBlock = _endBlock;

        lastTouchBlock = startBlock;

        totalVLiquidity = 0;
        totalNIZI = 0;
    }

    /// @notice Get the overall info for the mining contract.
    function getMiningContractInfo()
        external
        view
        returns (
            address oneSideToken_,
            address lockToken_,
            uint24 fee_,
            uint256 lockBoostMultiplier_,
            address iziTokenAddr_,
            uint256 lastTouchBlock_,
            uint256 totalVLiquidity_,
            uint256 totalLock_,
            uint256 totalNIZI_,
            uint256 startBlock_,
            uint256 endBlock_
        )
    {
        return (
            oneSideToken,
            lockToken,
            rewardPool.fee,
            lockBoostMultiplier,
            address(iziToken),
            lastTouchBlock,
            totalVLiquidity,
            totalLock,
            totalNIZI,
            startBlock,
            endBlock
        );
    }

    /// @dev compute amount of lockToken
    /// @param sqrtPriceX96 sqrtprice value viewed from uniswap pool
    /// @param oneSideAmount amount of oneSideToken user would deposit to swap pool
    ///    or amount computed corresponding to deposited uniswap NFT
    /// @return lockAmount amount of lockToken
    function _getLockAmount(uint160 sqrtPriceX96, uint256 oneSideAmount)
        private
        view
        returns (uint256 lockAmount)
    {
        // oneSideAmount is less than Q96, checked before
        uint256 precision = FixedPoints.Q96;
        uint256 sqrtPriceXP = sqrtPriceX96;

        // if price > 1, we discard the useless precision
        if (sqrtPriceX96 > FixedPoints.Q96) {
            precision = FixedPoints.Q32;
            // sqrtPriceXP <= Q96 after >> operation
            sqrtPriceXP = (sqrtPriceXP >> 64);
        }
        // priceXP < Q160 if price >= 1
        // priceXP < Q96  if price < 1
        // if sqrtPrice < 1, sqrtPriceXP < 2^(96)
        // if sqrtPrice > 1, precision of sqrtPriceXP is 32, sqrtPriceXP < 2^(160-64)
        // uint256 is enough for sqrtPriceXP ** 2
        uint256 priceXP = (sqrtPriceXP * sqrtPriceXP) / precision;
    
        if (priceXP > 0) {
            if (oneSideToken < lockToken) {
                // price is lockToken / oneSideToken
                // oneSideAmount < Q96
                // priceXP < Q160
                // oneSideAmount * priceXP < Q256, uint256 is enough
                lockAmount = (oneSideAmount * priceXP) / precision;
            } else {
                // oneSideAmount < Q96
                // precision < Q96
                // uint256 is enough for oneSideAmount * precision
                lockAmount = (oneSideAmount * precision) / priceXP;
            }
        } else {
             // in this case sqrtPriceXP <= Q48, precision = Q96
            if (oneSideToken < lockToken) {
                // price is lockToken / oneSideToken
                // lockAmount = oneSideAmount * sqrtPriceXP * sqrtPriceXP / precision / precision;
                // the above expression will always get 0
                lockAmount = 0;
            } else {
                lockAmount = oneSideAmount * precision / sqrtPriceXP / sqrtPriceXP; 
                // lockAmount is always < Q128, since sqrtPriceXP > Q32
                // we still add the require statement to double check
                require(lockAmount < FixedPoints.Q160, "TOO MUCH LOCK");
                lockAmount *= precision;
            }
        }
        require(lockAmount > 0, "LOCK 0");
    }

    /// @notice new a token status when touched.
    function _newTokenStatus(TokenStatus memory newTokenStatus) internal {
        tokenStatus[newTokenStatus.nftId] = newTokenStatus;
        TokenStatus storage t = tokenStatus[newTokenStatus.nftId];

        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = new uint256[](rewardInfosLen);
        // mark lastTouchAccRewardPerShare as current accRewardPerShare
        // to prevent collect reward generated before mining
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
        // mark lastTouchAccRewardPerShare as current accRewardPerShare
        // to prevent second-collect reward generated before update
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

    /// @dev get sqrtPrice of pool(oneSideToken/tokenSwap/fee)
    ///    and compute Point range converted from [TICK_MIN, PriceUni] or [PriceUni, TICK_MAX]
    /// @return sqrtPriceX96 current sqrtprice value viewed from uniswap pool, is a 96-bit fixed point number
    ///    note this value might mean price of lockToken/oneSideToken (if oneSideToken < lockToken)
    ///    or price of oneSideToken / lockToken (if oneSideToken > lockToken)
    /// @return leftPoint
    /// @return rightPoint
    function _getPriceAndPointRange(int24 stdPoint)
        private
        view
        returns (
            uint160 sqrtPriceX96,
            int24 leftPoint,
            int24 rightPoint
        )
    {
        (int24 avgPoint, uint160 avgSqrtPriceX96, int24 currPoint, ) = swapPool
            .getAvgPointPriceWithin2Hour();
        
        int56 delta = int56(avgPoint) - int56(stdPoint);
        delta = (delta >= 0) ? delta: -delta;
        require(delta < 2500, "TICK BIAS");

        int24 pointDelta = IiZiSwapFactory(iZiSwapFactory).fee2pointDelta(
            rewardPool.fee
        );
        if (oneSideToken < lockToken) {
            // price is lockToken / oneSideToken
            // oneSideToken is X
            leftPoint = Math.max(currPoint + 1, avgPoint);
            rightPoint = TICK_MAX;
            // round up to times of pointDelta
            // uniswap only receive Point which is times of pointDelta
            leftPoint = Math.tickUpper(leftPoint, pointDelta);
            rightPoint = Math.tickUpper(rightPoint, pointDelta);
        } else {
            // price is oneSideToken / lockToken
            // oneSideToken is Y
            rightPoint = Math.min(currPoint, avgPoint);
            leftPoint = TICK_MIN;
            // round down to times of pointDelta
            // uniswap only receive Point which is times of pointDelta
            leftPoint = Math.tickFloor(leftPoint, pointDelta);
            rightPoint = Math.tickFloor(rightPoint, pointDelta);
        }
        require(leftPoint < rightPoint, "L<R");
        sqrtPriceX96 = avgSqrtPriceX96;
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

    function depositWithoneSideToken(
        uint128 oneSideAmount,
        uint256 numIZI,
        int24 stdPoint,
        uint256 deadline
    ) external payable nonReentrant {
        require(oneSideAmount >= 1e7, "TOKENUNI AMOUNT TOO SMALL");
        require(oneSideAmount < FixedPoints.Q96 / 3, "TOKENUNI AMOUNT TOO LARGE");
        if (oneSideIsETH) {
            require(msg.value >= oneSideAmount, "ETHER INSUFFICIENT");
        } else {
            IERC20(oneSideToken).safeTransferFrom(
                msg.sender,
                address(this),
                oneSideAmount
            );
        }
        (
            uint160 sqrtPriceX96,
            int24 leftPoint,
            int24 rightPoint
        ) = _getPriceAndPointRange(stdPoint);

        TokenStatus memory newTokenStatus;

        IiZiSwapLiquidityManager.MintParam
            memory iZiSwapParams = iZiSwapCallingParams.mintParams(
                oneSideToken, lockToken, rewardPool.fee, oneSideAmount, 0, leftPoint, rightPoint, deadline
            );
        uint256 actualOneSideAmount;

        if (oneSideToken < lockToken) {
            (
                newTokenStatus.nftId,
                newTokenStatus.iZiSwapLiquidity,
                actualOneSideAmount,

            ) = IiZiSwapLiquidityManager(iZiSwapLiquidityManager).mint{
                value: msg.value
            }(iZiSwapParams);
        } else {
            (
                newTokenStatus.nftId,
                newTokenStatus.iZiSwapLiquidity,
                ,
                actualOneSideAmount
            ) = IiZiSwapLiquidityManager(iZiSwapLiquidityManager).mint{
                value: msg.value
            }(iZiSwapParams);
        }

        // mark owners and append to list
        owners[newTokenStatus.nftId] = msg.sender;
        bool res = tokenIds[msg.sender].add(newTokenStatus.nftId);
        require(res);

        if (actualOneSideAmount < oneSideAmount) {
            if (oneSideIsETH) {
                // refund oneSideToken
                // from uniswap to this
                IiZiSwapLiquidityManager(iZiSwapLiquidityManager).refundETH();
                // from this to msg.sender
                if (address(this).balance > 0)
                    _safeTransferETH(msg.sender, address(this).balance);
            } else {
                // refund oneSideToken
                IERC20(oneSideToken).safeTransfer(
                    msg.sender,
                    oneSideAmount - actualOneSideAmount
                );
            }
        }

        _updateGlobalStatus();
        newTokenStatus.vLiquidity = actualOneSideAmount * lockBoostMultiplier;
        newTokenStatus.lockAmount = _getLockAmount(
            sqrtPriceX96,
            newTokenStatus.vLiquidity
        );

        // make vLiquidity lower
        newTokenStatus.vLiquidity = newTokenStatus.vLiquidity / 1e6;

        IERC20(lockToken).safeTransferFrom(
            msg.sender,
            address(this),
            newTokenStatus.lockAmount
        );
        totalLock += newTokenStatus.lockAmount;
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
            iziToken.safeTransferFrom(
                msg.sender,
                address(this),
                newTokenStatus.nIZI
            );
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

        _updateVLiquidity(t.vLiquidity, false);
        if (t.nIZI > 0) {
            _updateNIZI(t.nIZI, false);
            // refund iZi to user
            iziToken.safeTransfer(msg.sender, t.nIZI);
        }
        if (t.lockAmount > 0) {
            // refund lockToken to user
            IERC20(lockToken).safeTransfer(msg.sender, t.lockAmount);
            totalLock -= t.lockAmount;
        }

        // first charge and send remain fee from uniswap to user
        (uint256 amountX, uint256 amountY) = IiZiSwapLiquidityManager(
            iZiSwapLiquidityManager
        ).collect(
            address(this),
            tokenId,
            type(uint128).max,
            type(uint128).max
        );
        uint256 refundAmountX = amountX * feeRemainPercent / 100;
        uint256 refundAmountY = amountY * feeRemainPercent / 100;
        _safeTransferToken(rewardPool.tokenX, msg.sender, refundAmountX);
        _safeTransferToken(rewardPool.tokenY, msg.sender, refundAmountY);
        totalFeeChargedX += amountX - refundAmountX;
        totalFeeChargedY += amountY - refundAmountY;

        // then decrease and collect from uniswap
        IiZiSwapLiquidityManager(iZiSwapLiquidityManager).decLiquidity(
            tokenId, uint128(t.iZiSwapLiquidity), 0, 0, type(uint256).max
        );
        (amountX, amountY) = IiZiSwapLiquidityManager(
            iZiSwapLiquidityManager
        ).collect(
            address(this),
            tokenId,
            type(uint128).max,
            type(uint128).max
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
        if (t.lockAmount > 0) {
            // we should ensure nft refund to user
            // omit the case when transfer() returns false unexpectedly
            IERC20(lockToken).transfer(owner, t.lockAmount);
        }
        // makesure user cannot withdraw/depositIZI or collect reward on this nft
        owners[tokenId] = address(0);
    }

}
