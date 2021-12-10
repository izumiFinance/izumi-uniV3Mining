// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

// Uncomment if needed.
import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../libraries/AmountMath.sol";
import "../libraries/LogPowMath.sol";
import "../libraries/MulDivMath.sol";
import "../libraries/UniswapOracle.sol";

import "../multicall.sol";

/// @title Simple math library for Max and Min.
library Math {

    uint160 internal constant MIN_SQRT_PRICE = 4295128739;

    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
    function max(int24 a, int24 b) internal pure returns (int24) {
        return a >= b ? a : b;
    }

    function min(int24 a, int24 b) internal pure returns (int24) {
        return a < b ? a : b;
    }
    function max(uint256 a, uint256 b) internal pure returns(uint256) {
        return a >= b ? a : b;
    }
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    function numMulSqrt2(uint256 a) internal pure returns (uint256) {
        return a * 1414213 / 1e6;
    }
    function numMulSqrt095(uint256 a) internal pure returns (uint256) {
        return a * 974679 / 1e6;
    }
    function numDivSqrt2(uint256 a) internal pure returns (uint256) {
        return a * 1e6 / 1414213;
    }
    function numDivSqrt095(uint256 a) internal pure returns (uint256) {
        return a * 1e6 / 974679;
    }

    function tickFloor(int24 tick, int24 tickSpacing)
        internal
        pure
        returns (int24)
    {
        int24 c = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) {
            c = c - 1;
        }
        c = c * tickSpacing;
        return c;
    }

    function tickUpper(int24 tick, int24 tickSpacing)
        internal
        pure
        returns (int24)
    {
        int24 c = tick / tickSpacing;
        if (tick > 0 && tick % tickSpacing != 0) {
            c = c + 1;
        }
        c = c * tickSpacing;
        return c;
    }
}

/// @title Uniswap V3 Liquidity Mining Main Contract
contract MiningOneSideBoost is Ownable, Multicall, ReentrancyGuard {
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

    bool uniIsETH;

    address uniToken;
    address lockToken;

    /// @dev Contract of the uniV3 Nonfungible Position Manager.
    address uniV3NFTManager;
    address uniFactory;
    address swapPool;
    PoolInfo public rewardPool;

    /// @dev Last block number that the accRewardRerShare is touched.
    uint256 lastTouchBlock;

    /// @dev The block number when NFT mining rewards starts/ends.
    uint256 startBlock;
    uint256 endBlock;

    uint256 lockBoostMultiplier;

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
        uint256 nftId;
        bool isDepositWithNFT;
        // only when isDepositWithNFT is false, uniLiquidity fields has meaning
        uint128 uniLiquidity;

        uint256 lockAmount;
        uint256 vLiquidity;
        uint256 validVLiquidity;
        uint256 nIZI;
        uint256 lastTouchBlock;
        uint256[] lastTouchAccRewardPerShare;
    }

    mapping(uint256 => TokenStatus) public tokenStatus;
    function lastTouchAccRewardPerShare(uint256 tokenId) public view returns(uint256[] memory lta) {
        TokenStatus memory t = tokenStatus[tokenId];
        uint256 len = t.lastTouchAccRewardPerShare.length;
        lta = new uint256[](len);
        for (uint256 i = 0; i < len; i ++) {
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
    // uint256 public totalLock;


    /// @dev 2 << 128
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    // Events
    event Deposit(address indexed user, uint256 tokenId, uint256 nIZI);
    event Withdraw(address indexed user, uint256 tokenId);
    event CollectReward(address indexed user, uint256 tokenId, address token, uint256 amount);
    event ModifyEndBlock(uint256 endBlock);
    event ModifyRewardPerBlock(address indexed rewardToken, uint256 rewardPerBlock);
    event ModifyProvider(address indexed rewardToken, address provider);

    function _setRewardPool(address _uniToken, address _lockToken, uint24 fee) internal {
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

        _setRewardPool(poolParams.uniTokenAddr, poolParams.lockTokenAddr, poolParams.fee);


        address weth = INonfungiblePositionManager(uniV3NFTManager).WETH9();
        require(weth != poolParams.lockTokenAddr, "weth not supported!");
        uniFactory = INonfungiblePositionManager(uniV3NFTManager).factory();

        uniToken = poolParams.uniTokenAddr;

        uniIsETH = (uniToken == weth);
        lockToken = poolParams.lockTokenAddr;

        swapPool = IUniswapV3Factory(uniFactory).getPool(
            lockToken,
            uniToken,
            poolParams.fee
        );
        require(swapPool != address(0), "No Uniswap Pool!");

        rewardInfosLen = _rewardInfos.length;
        require(rewardInfosLen > 0, "No Rewards!");
        require(rewardInfosLen < 3, "At most 2 Rewards!");

        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            rewardInfos[i] = _rewardInfos[i];
            rewardInfos[i].accRewardPerShare = 0;
        }

        require(_lockBoostMultiplier > 0, 'M>0');
        require(_lockBoostMultiplier < 4, 'M<4');

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
            // uint256 totalLock_,
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
            // totalLock,
            startBlock,
            endBlock
        );
    }

    function _getAmountUniForNFT(
        uint160 sqrtPriceAX96,
        uint160 sqrtPriceBX96,
        uint128 liquidity 
    ) internal view returns (uint256 uniAmount) {
        if (uniToken < lockToken) {
            // uniToken is token0
            uniAmount = AmountMath.getAmount0ForLiquidity(
                sqrtPriceAX96,
                sqrtPriceBX96,
                liquidity
            );
        } else {
            // uniToken is token1
            uniAmount = AmountMath.getAmount1ForLiquidity(
                sqrtPriceAX96,
                sqrtPriceBX96,
                liquidity
            );
        }
    }

    function _getSqrtPriceRangeForNFT(
        uint160 sqrtPriceX96
    ) internal view returns(uint160 sqrtPriceAX96, uint160 sqrtPriceBX96) {
        uint256 lower;
        uint256 upper;
        if (lockToken < uniToken) {
            // price for lockToken
            lower = Math.numDivSqrt2(sqrtPriceX96);
            upper = Math.numMulSqrt095(sqrtPriceX96);
        } else {
            // price for uniToken
            lower = Math.numDivSqrt095(sqrtPriceX96);
            upper = Math.numMulSqrt2(sqrtPriceX96);
        }
        require(lower > Math.MIN_SQRT_PRICE, "Lower Overflow!");
        require(upper < Math.MAX_SQRT_PRICE, "Upper Overflow!");
        sqrtPriceAX96 = uint160(lower);
        sqrtPriceBX96 = uint160(upper);
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
        uint256 priceX96 = MulDivMath.mulDivCeil(
            sqrtPriceX96,
            sqrtPriceX96,
            FixedPoints.Q96
        );
        if (uniToken < lockToken) {
            // price is lockToken / uniToken
            lockAmount = MulDivMath.mulDivCeil(
                uniAmount,
                priceX96,
                FixedPoints.Q96
            );
        } else {
            lockAmount = MulDivMath.mulDivCeil(
                uniAmount,
                FixedPoints.Q96,
                priceX96
            );
        }
    }

    function _checkRangeAndGetVLiquidity(int24 tickLower, int24 tickUpper, uint128 liquidity) internal view returns (
        uint256 vLiquidity,
        uint256 lockAmount
    ) {
        (, uint160 avgSqrtPriceX96, , ) = swapPool.getAvgTickPriceWithinHour();
        (uint160 sqrtPriceAX96, uint160 sqrtPriceBX96) = _getSqrtPriceRangeForNFT(avgSqrtPriceX96);
        uint160 sqrtLower = LogPowMath.getSqrtPrice(tickLower);
        uint160 sqrtUpper = LogPowMath.getSqrtPrice(tickUpper);
        require(sqrtLower <= sqrtPriceAX96, "Lower Not Cover!");
        require(sqrtUpper >= sqrtPriceBX96, "Upper Not Cover!");
        uint256 uniAmount = _getAmountUniForNFT(sqrtPriceAX96, sqrtPriceBX96, liquidity);
        
        require(uniAmount < type(uint128).max, "Amount Uni Can't Exceed 2**128!");
        require(uniAmount >= 1e7, "Amount TokenUni of NFT TOO SMALL!");
        lockAmount = _getLockAmount(avgSqrtPriceX96, uniAmount * lockBoostMultiplier);
        vLiquidity = uniAmount * lockBoostMultiplier / 1e6;
    }

    /// @notice new a token status when touched.
    function _newTokenStatus(
        TokenStatus memory newTokenStatus
    ) internal {
        tokenStatus[newTokenStatus.nftId] = newTokenStatus;
        TokenStatus storage t = tokenStatus[newTokenStatus.nftId];

        t.lastTouchBlock = lastTouchBlock;
        t.lastTouchAccRewardPerShare = new uint256[](rewardInfosLen);
        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            t.lastTouchAccRewardPerShare[i] = rewardInfos[i].accRewardPerShare;
        }
    }

    /// @notice update a token status when touched
    function _updateTokenStatus(
        uint256 tokenId,
        uint256 validVLiquidity,
        uint256 nIZI
    ) internal {
        TokenStatus storage t = tokenStatus[tokenId];
        
        // when not boost, validVL == vL
        t.validVLiquidity = validVLiquidity;
        t.nIZI = nIZI;

        t.lastTouchBlock = lastTouchBlock;
        for (uint256 i = 0; i < rewardInfosLen; i ++) {
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

        // max lockBoostMultiplier is 3
        require(totalVLiquidity <= Q128 * 3, "TOO MUCH LIQUIDITY STAKED");
    }

    function _updateNIZI(uint256 nIZI, bool isAdd) internal {
        if (isAdd) {
            totalNIZI = totalNIZI + nIZI;
        } else {
            totalNIZI = totalNIZI - nIZI;
        }
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

        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            // tokenReward < 2^25 * 2^64
            uint256 tokenReward = (currBlockNumber - lastTouchBlock) * rewardInfos[i].rewardPerBlock;
            // tokenReward * Q128 < 2^(25 + 64 + 128)
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
        uint256 iziVLiquidity = (vLiquidity * 4 + totalVLiquidity * nIZI * 6 / totalNIZI) / 10;
        return Math.min(iziVLiquidity, vLiquidity);
    }

    /// @dev get sqrtPrice of pool(uniToken/tokenSwap/fee)
    ///    and compute tick range converted from [PriceUni * 0.5, PriceUni]
    /// @return sqrtPriceX96 current sqrtprice value viewed from uniswap pool, is a 96-bit fixed point number
    ///    note this value might mean price of lockToken/uniToken (if uniToken < lockToken)
    ///    or price of uniToken / lockToken (if uniToken > lockToken)
    /// @return tickLeft
    /// @return tickRight
    function _getPriceAndTickRange() private view returns (uint160 sqrtPriceX96, int24 tickLeft, int24 tickRight) {
        (int24 avgTick, uint160 avgSqrtPriceX96, int24 currTick, ) = swapPool.getAvgTickPriceWithinHour();
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
    // fill INonfungiblePositionManager.MintParams struct to call INonfungiblePositionManager.mint(...)
    function _mintUniswapParam(
        uint256 uniAmount,
        int24 tickLeft,
        int24 tickRight,
        uint256 deadline
    )
        private
        view
        returns (INonfungiblePositionManager.MintParams memory params)
    {
        params.fee = rewardPool.fee;
        params.tickLower = tickLeft;
        params.tickUpper = tickRight;
        params.deadline = deadline;
        params.recipient = address(this);
        if (uniToken < lockToken) {
            params.token0 = uniToken;
            params.token1 = lockToken;
            params.amount0Desired = uniAmount;
            params.amount1Desired = 0;
            params.amount0Min = 1;
            params.amount1Min = 0;
        } else {
            params.token0 = lockToken;
            params.token1 = uniToken;
            params.amount0Desired = 0;
            params.amount1Desired = uniAmount;
            params.amount0Min = 0;
            params.amount1Min = 1;
        }
    }

    function depositWithuniToken(
        uint256 uniAmount, uint256 numIZI, uint256 deadline
    ) external nonReentrant payable {
        require(uniAmount < type(uint128).max, "Amount Uni Can't Exceed 2**128!");
        require(uniAmount >= 1e7, "Amount of TokenUni TOO SMALL!");
        if (uniIsETH) {
            require(msg.value >= uniAmount);
        } else {
            IERC20(uniToken).safeTransferFrom(
                address(msg.sender),
                address(this),
                uniAmount
            );
            IERC20(uniToken).safeApprove(uniV3NFTManager, uniAmount);
        }
        (uint160 sqrtPriceX96, int24 tickLeft, int24 tickRight) = _getPriceAndTickRange();

        TokenStatus memory newTokenStatus;

        INonfungiblePositionManager.MintParams memory uniParams = _mintUniswapParam(
            uniAmount,
            tickLeft,
            tickRight,
            deadline
        );
        uint256 actualAmountUni;

        // mark isDepositWithNFT as false, means the uniswap NFT is created by
        // this contract. When user calling withdraw(...) in the future
        // this contract will decrease the liquidity of NFT to 0
        // and refund corresponding uniToken and tokenSwap from uniswap
        newTokenStatus.isDepositWithNFT = false;

        if (uniToken < lockToken) {
            uint256 amount1;
            (
                newTokenStatus.nftId,
                newTokenStatus.uniLiquidity,
                actualAmountUni,
                amount1
            ) = INonfungiblePositionManager(uniV3NFTManager).mint{value: msg.value}(uniParams);
            require(actualAmountUni <= uniAmount, "Uniswap ActualUni Exceed!");
            require(amount1 == 0, "Uniswap No AmountStaking!");
        } else {
            uint256 amount0;
            (
                newTokenStatus.nftId,
                newTokenStatus.uniLiquidity,
                amount0,
                actualAmountUni
            ) = INonfungiblePositionManager(uniV3NFTManager).mint{value: msg.value}(uniParams);
            require(actualAmountUni <= uniAmount, "Uniswap ActualUni Exceed!");
            require(amount0 == 0, "Uniswap No AmountStaking!");
        }

        owners[newTokenStatus.nftId] = msg.sender;
        bool res = tokenIds[msg.sender].add(newTokenStatus.nftId);
        require(res);

        IERC20(uniToken).safeApprove(uniV3NFTManager, 0);
        if (actualAmountUni < uniAmount) {
            if (uniIsETH) {
                // refund uniToken
                INonfungiblePositionManager(uniV3NFTManager).sweepToken(uniToken, 0, msg.sender);
            } else {
                // refund uniToken
                IERC20(uniToken).safeTransfer(
                    address(msg.sender),
                    uniAmount - actualAmountUni
                );
            }
        }

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        newTokenStatus.vLiquidity = actualAmountUni * lockBoostMultiplier;
        newTokenStatus.lockAmount = _getLockAmount(sqrtPriceX96, newTokenStatus.vLiquidity);
        // make vLiquidity lower
        newTokenStatus.vLiquidity = newTokenStatus.vLiquidity / 1e6;

        IERC20(lockToken).safeTransferFrom(
            address(msg.sender),
            address(this),
            newTokenStatus.lockAmount
        );
        // totalLock += newTokenStatus.lockAmount;
        _updateVLiquidity(newTokenStatus.vLiquidity, true);

        newTokenStatus.nIZI = numIZI;
        if (address(iziToken) == address(0)) {
            // boost is not enabled
            newTokenStatus.nIZI = 0;
        }
        _updateNIZI(newTokenStatus.nIZI, true);
        newTokenStatus.validVLiquidity = _computeValidVLiquidity(newTokenStatus.vLiquidity, newTokenStatus.nIZI);
        require(newTokenStatus.nIZI < Q128 / 6, 'NIZI O');
        _newTokenStatus(newTokenStatus);
        if (newTokenStatus.nIZI > 0) {
            // lock izi in this contract
            iziToken.safeTransferFrom(msg.sender, address(this), newTokenStatus.nIZI);
        }

        emit Deposit(msg.sender, newTokenStatus.nftId, newTokenStatus.nIZI);

    }

    function _withdrawUniswapParam(
        uint256 uniPositionID,
        uint128 liquidity,
        uint256 deadline
    )
        private
        pure
        returns (
            INonfungiblePositionManager.DecreaseLiquidityParams memory params
        )
    {
        params.tokenId = uniPositionID;
        params.liquidity = liquidity;
        params.amount0Min = 0;
        params.amount1Min = 0;
        params.deadline = deadline;
    }

    /// @notice Deposit a single position.
    /// @param tokenId The related position id.
    /// @param numIZI the amount of izi to lock
    function deposit(uint256 tokenId, uint256 numIZI) external nonReentrant {
        address owner = INonfungiblePositionManager(uniV3NFTManager).ownerOf(tokenId);
        require(owner == msg.sender, "NOT OWNER");

        TokenStatus memory newTokenStatus;

        // transfer nft to this contract
        newTokenStatus.nftId = tokenId;
        newTokenStatus.isDepositWithNFT = true;

        INonfungiblePositionManager(uniV3NFTManager).transferFrom(msg.sender, address(this), tokenId);
        owners[tokenId] = msg.sender;
        bool res = tokenIds[msg.sender].add(tokenId);
        require(res);

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
        ) = INonfungiblePositionManager(uniV3NFTManager).positions(tokenId);

        // alternatively we can compute the pool address with tokens and fee and compare the address directly
        require(token0 == rewardPool.token0, "TOEKN0 NOT MATCH");
        require(token1 == rewardPool.token1, "TOKEN1 NOT MATCH");
        require(fee == rewardPool.fee, "FEE NOT MATCH");

        // require the NFT token fully covers [0.5PC, 0.95PC], PC is current price of lockToken/uniToken
        (newTokenStatus.vLiquidity, newTokenStatus.lockAmount) = _checkRangeAndGetVLiquidity(tickLower, tickUpper, liquidity);


        // make vLiquidity lower
        newTokenStatus.vLiquidity = newTokenStatus.vLiquidity / 1e6;
        newTokenStatus.uniLiquidity = liquidity;
        
        require(newTokenStatus.vLiquidity > 0, "INVALID TOKEN");
        
        if (newTokenStatus.lockAmount > 0) {
            IERC20(lockToken).safeTransferFrom(msg.sender, address(this), newTokenStatus.lockAmount);
            // totalLock += newTokenStatus.lockAmount;
        }

        // the execution order for the next three lines is crutial
        _updateGlobalStatus();
        _updateVLiquidity(newTokenStatus.vLiquidity, true);

        newTokenStatus.nIZI = numIZI;
        if (address(iziToken) == address(0)) {
            // boost is not enabled
            newTokenStatus.nIZI = 0;
        }
        _updateNIZI(newTokenStatus.nIZI, true);
        newTokenStatus.validVLiquidity = _computeValidVLiquidity(newTokenStatus.vLiquidity, newTokenStatus.nIZI);
        require(newTokenStatus.nIZI < Q128 / 6, 'NIZI O');
        _newTokenStatus(newTokenStatus);
        if (newTokenStatus.nIZI > 0) {
            // lock izi in this contract
            iziToken.safeTransferFrom(msg.sender, address(this), newTokenStatus.nIZI);
        }

        emit Deposit(msg.sender, tokenId, newTokenStatus.nIZI);
    }

    /// @notice deposit iZi to an nft token
    /// @param tokenId nft already deposited
    /// @param deltaNIZI amount of izi to deposit
    function depositIZI(uint256 tokenId, uint256 deltaNIZI) nonReentrant external {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        require(address(iziToken) != address(0), "NOT BOOST!");
        require(deltaNIZI > 0, "DEPOSIT IZI MUST BE POSITIVE!");
        _collectReward(tokenId);
        TokenStatus memory t = tokenStatus[tokenId];
        _updateNIZI(deltaNIZI, true);
        uint256 nIZI = t.nIZI + deltaNIZI;
        // update validVLiquidity
        uint256 validVLiquidity = _computeValidVLiquidity(t.vLiquidity, nIZI);
        _updateTokenStatus(tokenId, validVLiquidity, nIZI);

        // transfer iZi from user
        iziToken.safeTransferFrom(msg.sender, address(this), deltaNIZI);
        
    }

    /// @notice withdraw iZi from an nft token
    /// @param tokenId nft already deposited
    /// @param deltaNIZI amount of izi to withdraw
    function withdrawIZI(uint256 tokenId, uint256 deltaNIZI) nonReentrant external {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        require(address(iziToken) != address(0), "NOT BOOST!");
        require(deltaNIZI > 0, "DEPOSIT IZI MUST BE POSITIVE!");
        _collectReward(tokenId);
        TokenStatus memory t = tokenStatus[tokenId];
        _updateNIZI(deltaNIZI, false);
        // safemath of 0.8 will revert if deltaNIZI > t.nIZI
        uint256 nIZI = t.nIZI - deltaNIZI;
        // update validVLiquidity
        uint256 validVLiquidity = _computeValidVLiquidity(t.vLiquidity, nIZI);
        _updateTokenStatus(tokenId, validVLiquidity, nIZI);
        // refund iZi to user
        iziToken.transfer(msg.sender, deltaNIZI);
    }

    // fill INonfungiblePositionManager.CollectParams struct to call INonfungiblePositionManager.collect(...)
    function _collectUniswapParam(uint256 uniPositionID, address recipient)
        private
        pure
        returns (INonfungiblePositionManager.CollectParams memory params)
    {
        params.tokenId = uniPositionID;
        params.recipient = recipient;
        params.amount0Max = 0xffffffffffffffffffffffffffffffff;
        params.amount1Max = 0xffffffffffffffffffffffffffffffff;
    }

    /// @notice Widthdraw a single position.
    /// @param tokenId The related position id.
    /// @param noReward true if use want to withdraw without reward
    function withdraw(uint256 tokenId, bool noReward) nonReentrant external {
        require(owners[tokenId] == msg.sender, "NOT OWNER OR NOT EXIST");

        if (noReward) {
            // The collecting procedure is commenced out.
            // collectReward(tokenId);
            // The global status needs update since the vLiquidity is changed after withdraw.
            _updateGlobalStatus();
        } else {
            _collectReward(tokenId);
        }
        TokenStatus storage t = tokenStatus[tokenId];

        _updateVLiquidity(t.vLiquidity, false);
        if (t.nIZI > 0) {
            _updateNIZI(t.nIZI, false);
            // refund iZi to user
            iziToken.transfer(msg.sender, t.nIZI);
        }
        if (t.lockAmount > 0) {
            // refund lockToken to user
            IERC20(lockToken).transfer(msg.sender, t.lockAmount);
            // totalLock -= t.lockAmount;
        }

        if (!t.isDepositWithNFT) {
            // collect swap fee and withdraw uniToken lockToken from uniswap
            INonfungiblePositionManager.DecreaseLiquidityParams
                memory decUniParams = _withdrawUniswapParam(
                    tokenId,
                    t.uniLiquidity,
                    type(uint256).max
                );
            INonfungiblePositionManager.CollectParams
                memory collectUniParams = _collectUniswapParam(
                    tokenId,
                    msg.sender
                );
            INonfungiblePositionManager(uniV3NFTManager).decreaseLiquidity(
                decUniParams
            );
            INonfungiblePositionManager(uniV3NFTManager).collect(
                collectUniParams
            );
        } else {
            // send deposited NFT to user
            IERC721(uniV3NFTManager).transferFrom(
                address(this),
                msg.sender,
                tokenId
            );
        }

        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        delete tokenStatus[tokenId];

        emit Withdraw(msg.sender, tokenId);
    }

    /// @notice Collect pending reward for a single position.
    /// @param tokenId The related position id.
    function _collectReward(uint256 tokenId) internal {
        TokenStatus memory t = tokenStatus[tokenId];

        _updateGlobalStatus();
        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            uint256 _reward = (t.validVLiquidity * (rewardInfos[i].accRewardPerShare - t.lastTouchAccRewardPerShare[i])) / Q128;
            if (_reward > 0) {
                IERC20(rewardInfos[i].rewardToken).safeTransferFrom(rewardInfos[i].provider, msg.sender, _reward);
            }
            emit CollectReward(msg.sender, tokenId, rewardInfos[i].rewardToken, _reward);
        }

        uint256 nIZI = t.nIZI;
        // update validVLiquidity
        uint256 validVLiquidity = _computeValidVLiquidity(t.vLiquidity, nIZI);
        _updateTokenStatus(tokenId, validVLiquidity, nIZI);
    }

    /// @notice Collect pending reward for a single position.
    /// @param tokenId The related position id.
    function collect(uint256 tokenId) nonReentrant external {
        require(owners[tokenId] == msg.sender, "NOT OWNER or NOT EXIST");
        _collectReward(tokenId);
        INonfungiblePositionManager.CollectParams memory params = _collectUniswapParam(tokenId, msg.sender);
        // collect swap fee from uniswap
        INonfungiblePositionManager(uniV3NFTManager).collect(params);
    }

    /// @notice Collect all pending rewards.
    function collectAllTokens() nonReentrant external {
        EnumerableSet.UintSet storage ids = tokenIds[msg.sender];
        for (uint256 i = 0; i < ids.length(); i++) {
            require(owners[ids.at(i)] == msg.sender, "NOT OWNER");
            _collectReward(ids.at(i));
            INonfungiblePositionManager.CollectParams memory params = _collectUniswapParam(ids.at(i), msg.sender);
            // collect swap fee from uniswap
            INonfungiblePositionManager(uniV3NFTManager).collect(params);
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
    function _getRewardBlockNum(uint256 _from, uint256 _to)
        internal
        view
        returns (uint256)
    {
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
    function pendingReward(uint256 tokenId) public view returns (uint256[] memory) {
        TokenStatus memory t = tokenStatus[tokenId];
        uint256[] memory _reward = new uint256[](rewardInfosLen);
        for (uint256 i = 0; i < rewardInfosLen; i ++) {
            uint256 tokenReward = _getRewardBlockNum(lastTouchBlock, block.number) * rewardInfos[i].rewardPerBlock;
            uint256 rewardPerShare = rewardInfos[i].accRewardPerShare + (tokenReward * Q128) / totalVLiquidity;
            // l * (currentAcc - lastAcc)
            _reward[i] = (t.validVLiquidity * (rewardPerShare - t.lastTouchAccRewardPerShare[i])) / Q128;
        }
        return _reward;
    }

    /// @notice View function to see pending Rewards for an address.
    /// @param _user The related address.
    function pendingRewards(address _user) external view returns (uint256[] memory) {
        uint256[] memory _reward = new uint256[](rewardInfosLen);
        for (uint256 j = 0; j < rewardInfosLen; j ++) {
            _reward[j] = 0;
        }
        
        for (uint256 i = 0; i < tokenIds[_user].length(); i++) {
            uint256[] memory r = pendingReward(tokenIds[_user].at(i));
            for (uint256 j = 0; j < rewardInfosLen; j ++) {
                _reward[j] += r[j];
            }
        }
        return _reward;
    }

    // Control fuctions for the contract owner and operators.

    /// @notice If something goes wrong, we can send back user's nft and locked iZi
    /// @param tokenId The related position id.
    function emergenceWithdraw(uint256 tokenId) external onlyOwner {
        INonfungiblePositionManager(uniV3NFTManager).safeTransferFrom(address(this), owners[tokenId], tokenId);

        owners[tokenId] = address(0);
        bool res = tokenIds[msg.sender].remove(tokenId);
        require(res);

        TokenStatus storage t = tokenStatus[tokenId];
        if (t.nIZI > 0) {
            iziToken.transfer(msg.sender, t.nIZI);
        }
        if (t.lockAmount > 0) {
            IERC20(lockToken).transfer(msg.sender, t.lockAmount);
        }
        delete tokenStatus[tokenId];
    }

    /// @notice Set new reward end block.
    /// @param _endBlock New end block.
    function modifyEndBlock(uint256 _endBlock) external onlyOwner {
        _updateGlobalStatus();
        endBlock = _endBlock;
        emit ModifyEndBlock(endBlock);
    }

    /// @notice Set new reward per block.
    /// @param rewardIdx which rewardInfo to modify
    /// @param _rewardPerBlock new reward per block
    function modifyRewardPerBlock(uint rewardIdx, uint _rewardPerBlock) external onlyOwner {
        require(rewardIdx < rewardInfosLen, "OUT OF REWARD INFO RANGE");
        _updateGlobalStatus();
        rewardInfos[rewardIdx].rewardPerBlock = _rewardPerBlock;
        emit ModifyRewardPerBlock(rewardInfos[rewardIdx].rewardToken, _rewardPerBlock);
    }


    /// @notice Set new reward per block.
    /// @param rewardIdx which rewardInfo to modify
    /// @param provider New provider
    function modifyProviderPerBlock(uint rewardIdx, address provider) external onlyOwner {
        require(rewardIdx < rewardInfosLen, "OUT OF REWARD INFO RANGE");
        _updateGlobalStatus();
        rewardInfos[rewardIdx].provider = provider;
        emit ModifyProvider(rewardInfos[rewardIdx].rewardToken, provider);
    }

}
