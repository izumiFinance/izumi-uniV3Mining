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

import "../base/MiningBase.sol";

/// @title Interface for WETH9
interface IWETH9 is IERC20 {
    /// @notice Deposit ether to get wrapped ether
    function deposit() external payable;

    /// @notice Withdraw wrapped ether to get ether
    function withdraw(uint256) external;
}


/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningOneSideBoost is MiningBase {
    // using Math for int24;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;

    using UniswapOracle for address;

    int24 internal constant TICK_MAX = 500000;
    int24 internal constant TICK_MIN = -500000;

    struct PoolInfo {
        address token0;
        address token1;
        uint24 fee;
    }

    bool public uniIsETH;

    address public uniToken;
    address public lockToken;

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    address public uniV3NFTManager;
    address public uniFactory;
    address public swapPool;
    PoolInfo public rewardPool;

    uint256 public lockBoostMultiplier;
    /// @dev Current total lock token
    uint256 public totalLock;

    /// @dev Record the status for a certain token for the last touched time.
    struct TokenStatus {
        uint256 nftId;
        // bool isDepositWithNFT;
        uint128 uniLiquidity;
        uint256 lockAmount;
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
        uint256[] lastTouchAccRewardPerShare;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;

    function getBaseTokenStatus(uint256 tokenId) internal override view returns(BaseTokenStatus memory t) {
        TokenStatus memory ts = tokenStatus[tokenId];
        t = BaseTokenStatus({
            vLiquidity: ts.vLiquidity,
            validVLiquidity: ts.validVLiquidity,
            nIZI: ts.nIZI,
            lastTouchAccRewardPerShare: ts.lastTouchAccRewardPerShare
        });
    }

    receive() external payable {}

    function _setRewardPool(
        address _uniToken,
        address _lockToken,
        uint24 fee
    ) internal {
        address token0;
        address token1;
        if (_uniToken < _lockToken) {
            token0 = _uniToken;
            token1 = _lockToken;
        } else {
            token0 = _lockToken;
            token1 = _uniToken;
        }
        rewardPool.token0 = token0;
        rewardPool.token1 = token1;
        rewardPool.fee = fee;
    }

    struct PoolParams {
        address uniV3NFTManager;
        address uniTokenAddr;
        address lockTokenAddr;
        uint24 fee;
    }

    constructor(
        PoolParams memory poolParams,
        RewardInfo[] memory _rewardInfos,
        uint256 _lockBoostMultiplier,
        address iziTokenAddr,
        uint256 _startBlock,
        uint256 _endBlock
    ) {
        uniV3NFTManager = poolParams.uniV3NFTManager;

        _setRewardPool(
            poolParams.uniTokenAddr,
            poolParams.lockTokenAddr,
            poolParams.fee
        );

        address weth = INonfungiblePositionManager(uniV3NFTManager).WETH9();
        require(weth != poolParams.lockTokenAddr, "WETH NOT SUPPORT");
        uniFactory = INonfungiblePositionManager(uniV3NFTManager).factory();

        uniToken = poolParams.uniTokenAddr;

        uniIsETH = (uniToken == weth);
        lockToken = poolParams.lockTokenAddr;

        IERC20(uniToken).safeApprove(uniV3NFTManager, type(uint256).max);

        swapPool = IUniswapV3Factory(uniFactory).getPool(
            lockToken,
            uniToken,
            poolParams.fee
        );
        require(swapPool != address(0), "NO UNI POOL");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "NO REWARD");
        require(rewardInfosLen < 3, "AT MOST 2 REWARDS");

        for (uint256 i = 0; i < rewardInfosLen; i++) {
            rewardInfos[i] = _rewardInfos[i];
            rewardInfos[i].accRewardPerShare = 0;
        }

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
            address uniToken_,
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
            uniToken,
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
    /// @param uniAmount amount of uniToken user deposits
    ///    or amount computed corresponding to deposited uniswap NFT
    /// @return lockAmount amount of lockToken
    function _getLockAmount(uint160 sqrtPriceX96, uint256 uniAmount)
        private
        view
        returns (uint256 lockAmount)
    {
        // uniAmount is less than Q96, checked before
        uint256 precision = FixedPoints.Q96;
        uint256 sqrtPriceXP = sqrtPriceX96;

        // if price > 1, we discard the useless precision
        if (sqrtPriceX96 > FixedPoints.Q96) {
            precision = FixedPoints.Q32;
            // sqrtPriceXP <= Q96 after >> operation
            sqrtPriceXP = (sqrtPriceXP >> 64);
        }
        // priceXP <= Q160 if price >= 1
        // priceXP <= Q96  if price < 1
        uint256 priceXP = (sqrtPriceXP * sqrtPriceXP) / precision;
    
        if (priceXP > 0) {
            if (uniToken < lockToken) {
                // price is lockToken / uniToken
                lockAmount = (uniAmount * priceXP) / precision;
            } else {
                lockAmount = (uniAmount * precision) / priceXP;
            }
        } else {
             // in this case sqrtPriceXP <= Q48, precision = Q96
            if (uniToken < lockToken) {
                // price is lockToken / uniToken
                // lockAmount = uniAmount * sqrtPriceXP * sqrtPriceXP / precision / precision;
                // the above expression will always get 0
                lockAmount = 0;
            } else {
                lockAmount = uniAmount * precision / sqrtPriceXP / sqrtPriceXP; 
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

    /// @dev get sqrtPrice of pool(uniToken/tokenSwap/fee)
    ///    and compute tick range converted from [TICK_MIN, PriceUni] or [PriceUni, TICK_MAX]
    /// @return sqrtPriceX96 current sqrtprice value viewed from uniswap pool, is a 96-bit fixed point number
    ///    note this value might mean price of lockToken/uniToken (if uniToken < lockToken)
    ///    or price of uniToken / lockToken (if uniToken > lockToken)
    /// @return tickLeft
    /// @return tickRight
    function _getPriceAndTickRange()
        private
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tickLeft,
            int24 tickRight
        )
    {
        (int24 avgTick, uint160 avgSqrtPriceX96, int24 currTick, ) = swapPool
            .getAvgTickPriceWithin2Hour();
        int24 tickSpacing = IUniswapV3Factory(uniFactory).feeAmountTickSpacing(
            rewardPool.fee
        );
        if (uniToken < lockToken) {
            // price is lockToken / uniToken
            // uniToken is X
            tickLeft = Math.max(currTick + 1, avgTick);
            tickRight = TICK_MAX;
            tickLeft = Math.tickUpper(tickLeft, tickSpacing);
            tickRight = Math.tickUpper(tickRight, tickSpacing);
        } else {
            // price is uniToken / lockToken
            // uniToken is Y
            tickRight = Math.min(currTick, avgTick);
            tickLeft = TICK_MIN;
            tickLeft = Math.tickFloor(tickLeft, tickSpacing);
            tickRight = Math.tickFloor(tickRight, tickSpacing);
        }
        require(tickLeft < tickRight, "L<R");
        sqrtPriceX96 = avgSqrtPriceX96;
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

    function depositWithuniToken(
        uint256 uniAmount,
        uint256 numIZI,
        uint256 deadline
    ) external payable nonReentrant {
        require(uniAmount >= 1e7, "TOKENUNI AMOUNT TOO SMALL");
        require(uniAmount < FixedPoints.Q96 / 3, "TOKENUNI AMOUNT TOO LARGE");
        if (uniIsETH) {
            require(msg.value >= uniAmount, "ETHER INSUFFICIENT");
        } else {
            IERC20(uniToken).safeTransferFrom(
                msg.sender,
                address(this),
                uniAmount
            );
        }
        (
            uint160 sqrtPriceX96,
            int24 tickLeft,
            int24 tickRight
        ) = _getPriceAndTickRange();

        TokenStatus memory newTokenStatus;

        INonfungiblePositionManager.MintParams
            memory uniParams = UniswapCallingParams.mintParams(
                uniToken, lockToken, rewardPool.fee, uniAmount, 0, tickLeft, tickRight, deadline
            );
        uint256 actualAmountUni;

        if (uniToken < lockToken) {
            (
                newTokenStatus.nftId,
                newTokenStatus.uniLiquidity,
                actualAmountUni,

            ) = INonfungiblePositionManager(uniV3NFTManager).mint{
                value: msg.value
            }(uniParams);
        } else {
            (
                newTokenStatus.nftId,
                newTokenStatus.uniLiquidity,
                ,
                actualAmountUni
            ) = INonfungiblePositionManager(uniV3NFTManager).mint{
                value: msg.value
            }(uniParams);
        }

        // mark owners and append to list
        owners[newTokenStatus.nftId] = msg.sender;
        bool res = tokenIds[msg.sender].add(newTokenStatus.nftId);
        require(res);

        if (actualAmountUni < uniAmount) {
            if (uniIsETH) {
                // refund uniToken
                // from uniswap to this
                INonfungiblePositionManager(uniV3NFTManager).refundETH();
                // from this to msg.sender
                if (address(this).balance > 0)
                    safeTransferETH(msg.sender, address(this).balance);
            } else {
                // refund uniToken
                IERC20(uniToken).safeTransfer(
                    msg.sender,
                    uniAmount - actualAmountUni
                );
            }
        }

        _updateGlobalStatus();
        newTokenStatus.vLiquidity = actualAmountUni * lockBoostMultiplier;
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

        INonfungiblePositionManager(uniV3NFTManager).decreaseLiquidity(
            UniswapCallingParams.decreaseLiquidityParams(tokenId, t.uniLiquidity, type(uint256).max)
        );

        if (!uniIsETH) {
            INonfungiblePositionManager(uniV3NFTManager).collect(
                UniswapCallingParams.collectParams(tokenId, msg.sender)
            );
        } else {
            (uint256 amount0, uint256 amount1) = INonfungiblePositionManager(
                uniV3NFTManager
            ).collect(
                UniswapCallingParams.collectParams(tokenId, msg.sender)
            );
            (uint256 amountUni, uint256 amountLock) = (uniToken < lockToken)? (amount0, amount1) : (amount1, amount0);
            if (amountLock > 0) {
                IERC20(lockToken).safeTransfer(msg.sender, amountLock);
            }

            if (amountUni > 0) {
                IWETH9(uniToken).withdraw(amountUni);
                safeTransferETH(msg.sender, amountUni);
            }
        }

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
        INonfungiblePositionManager.CollectParams
            memory params = UniswapCallingParams.collectParams(tokenId, msg.sender);
        // collect swap fee from uniswap
        INonfungiblePositionManager(uniV3NFTManager).collect(params);
    }

    /// @notice Collect all pending rewards.
    function collectAllTokens() external nonReentrant {
        EnumerableSet.UintSet storage ids = tokenIds[msg.sender];
        for (uint256 i = 0; i < ids.length(); i++) {
            uint256 tokenId = ids.at(i);
            require(owners[tokenId] == msg.sender, "NOT OWNER");
            _collectReward(tokenId);
            INonfungiblePositionManager.CollectParams
                memory params = UniswapCallingParams.collectParams(tokenId, msg.sender);
            // collect swap fee from uniswap
            INonfungiblePositionManager(uniV3NFTManager).collect(params);
        }
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
