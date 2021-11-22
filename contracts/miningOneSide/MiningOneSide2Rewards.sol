// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.4;

// Uncomment if needed.
import "hardhat/console.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../libraries/AmountMath.sol";
import "../libraries/LogPowMath.sol";
import "../libraries/MulDivMath.sol";
import "../libraries/UniswapOracle.sol";
import "../libraries/Math.sol";

import "../uniswap/interfaces.sol";
import "../utils.sol";
import "../multicall.sol";

contract MiningOneSide2Rewards is Ownable, Multicall {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.UintSet;
    using UniswapOracle for address;

    struct RewardInfo {
        // token0 to reward
        address token0;
        // provider to provide reward
        address provider0;
        // token amount of reward generated per block
        // in form of 128-bit fixed point number
        uint256 tokenPerBlock0;

        // token1 to reward
        address token1;
        // provider to provide reward
        address provider1;
        // token amount of reward generated per block
        // in form of 128-bit fixed point number
        uint256 tokenPerBlock1;
    }
    RewardInfo public rewardInfo;
    
    // accRewardPerShare0 is amount of token0 reward per unit vLiquidity from startBlock to min{lastRewardBlock, endBlock}
    // in a form of 128-bit fixed point number
    uint256 accRewardPerShare0;
    // similar to accRewardPerShare0
    uint256 accRewardPerShare1;
    uint256 lastRewardBlock;
        
    // sum of vLiquidity of all MiningInfos
    uint256 totalVLiquidity;

    // block number to finish reward
    uint256 endBlock;
    // block number to start reward
    uint256 startBlock;

    struct MiningInfo {
        // amount of tokenLock user locked in MiningOneSide
        uint256 amountLock;
        // virtual liquidity, which is equal to uniMultiplier * amountUni
        // vLiquidity * accRewardPerShare / 2**128 is reward amount of this mining
        uint256 vLiquidity;
        // for reward0, value of 'accRewardPerShare0' when latest update MiningInfo
        uint256 lastTouchAccRewardPerShare0;
        // similar to lastTouchAccRewardPerShare0
        uint256 lastTouchAccRewardPerShare1;
        // NFT ID of uniswap
        uint256 uniPositionID;
        // liquidity in uniswap of NFT 'uniPositionID'
        uint128 uniLiquidity;
        // isUniPositionIDExternal is true, means user deposit his/her NFT (with tokenid of uniPositionID)
        //    token when calling mint(...)
        // isUniPositionIDExternal is false, means user deposit tokenUni to this mining contract and this contract will
        //    generate a uniswap NFT (id will be record in 'uniPositionID')
        bool isUniPositionIDExternal;
    }

    // token to lock in this mining contract
    address public tokenLock;
    // token to send to uniswap
    address public tokenUni;
    // swap fee of (tokenUni, tokenLock) in uniswap
    // if fee is 3000, means swap fee is 0.3%
    uint24 public fee;
    
    // total number of MiningInfo objects (newly created, collected, withdrawed) in this contract
    // the ID of MiningInfo is [0, miningNum)
    uint256 public miningNum = 0;

    // nonfungibal position manager of uniswap-periphery
    address public nftManager;
    // factory of uniswap-core
    address public uniFactory;
    // pool of (tokenUni/tokenLock/fee)
    address public swapPool;

    // sqrt2A / sqrt2B is sqrt(2)
    uint256 internal constant sqrt2A = 141421;
    uint256 internal constant sqrt2B = 100000;

    // owner address of MiningInfo
    // each MiningInfo has a unique MiningInfoID
    mapping(uint256 => address) public miningOwner;
    // MiningInfoID to MiningInfo
    mapping(uint256 => MiningInfo) public miningInfos;
    // one address may own more than one MiningInfoIDs
    mapping(address => EnumerableSet.UintSet) private addr2MiningIDs;

    /// @dev Emitted when success to call mint(...) or mintWithExistingNFT(...), see ether of these 2 functions to
    ///    learn more
    /// @param miningID id to specify newly created MiningInfo
    /// @param owner address owning the MiningInfo specified by miningID, owner is msg.sender currently
    /// @param vLiquidity vLiquidity of miningInfo, see MiningInfo
    /// @param amountLock amount of tokenLock locked from msg.sender, before withdraw, the tokenLock will be locked
    ///    in this contract
    event Mint(
        uint256 indexed miningID,
        address indexed owner,
        uint256 vLiquidity,
        uint256 amountLock
    );
    /// @dev Emitted when success to call collect(...), see collect(...) to learn more
    /// @param miningID id to specify MiningInfo which is collected
    /// @param recipient address to receive fee of uniswap-nft and reward of mining
    /// @param amountUni amount of tokenUni (fee from uniswap) received by recipient
    /// @param amountLock amount of tokenLock (fee from uniswap) received by recipient
    /// @param amountReward0 amount of token0 (mining reward) received by recipient
    /// @param amountReward1 amount of token1 (mining reward) received by recipient
    event Collect(
        uint256 indexed miningID,
        address indexed recipient,
        uint256 amountUni,
        uint256 amountLock,
        uint256 amountReward0,
        uint256 amountReward1
    );
    /// @dev Emitted when success to call withdraw(...), see withdraw(...) to learn more
    /// @param miningID id to specify MiningInfo which is withdrawed
    /// @param recipient address to receive uniswap fee, tokenReward, tokenLocked
    ///    and tokenUni(or uniswap NFT if the MiningInfo is created by mintWithExistingNFT(...))
    /// @param amountUni amount of tokenUni received by recipient
    ///    if the miningID is created by mint(...), amountUni contains uniswap fee and amount of tokenUni deposit
    ///    if the miningID is created by mintWithExistingNFT(...), amountUni is only uniswap fee
    /// @param amountLock amount of tokenLock (including fee from uniswap) received by recipient
    /// @param amountReward0 amount of token0 (mining reward) received by recipient
    /// @param amountReward1 amount of token1 (mining reward) received by recipient
    event Withdraw(
        uint256 indexed miningID,
        address indexed recipient,
        uint256 amountUni,
        uint256 amountLock,
        uint256 amountReward0,
        uint256 amountReward1
    );

    /// @dev contructor of this mining contract
    /// @param tokenUniAddr address of tokenUni, see tokenUni
    /// @param tokenLockAddr address of tokenLock, see tokenLock
    /// @param swapFee fee of uniswap, 3000 means 0.3%, see fee
    /// @param nfPositionManager nonfungible position manager of uniswap, see nftManager
    /// @param rewardInfoParams see RewardInfo
    /// @param _startBlock block number when starting reward
    /// @param _endBlock block number when finishing reward
    constructor(
        address tokenUniAddr,
        address tokenLockAddr,
        uint24 swapFee,
        address nfPositionManager,
        RewardInfo memory rewardInfoParams,
        uint256 _startBlock,
        uint256 _endBlock
    ) {
        tokenUni = tokenUniAddr;
        tokenLock = tokenLockAddr;
        fee = swapFee;

        nftManager = nfPositionManager;
        address weth = INonfungiblePositionManager(nfPositionManager).WETH9();
        require(weth != tokenUniAddr, "weth not supported!");
        require(weth != tokenLockAddr, "weth not supported!");
        uniFactory = INonfungiblePositionManager(nfPositionManager).factory();

        swapPool = IUniswapV3Factory(uniFactory).getPool(
            tokenLock,
            tokenUni,
            fee
        );
        require(swapPool != address(0), "No Uniswap Pool!");

        rewardInfo = rewardInfoParams;

        require(
            _startBlock < _endBlock,
            "start < end"
        );
        startBlock = _startBlock;
        endBlock = _endBlock;

        totalVLiquidity = 0;
        accRewardPerShare0 = 0;
        accRewardPerShare1 = 0;
        lastRewardBlock = _startBlock;
    }

    modifier checkMiningOwner(uint256 miningID) {
        require(miningOwner[miningID] == msg.sender, "Not Owner!");
        _;
    }

    function setRewardProvider(address provider, bool isReward0) external onlyOwner {
        if (isReward0) {
            rewardInfo.provider0 = provider;
        } else {
            rewardInfo.provider1 = provider;
        }
    }

    function setRewardTokenPerBlock(uint256 tokenPerBlock, bool isReward0) external onlyOwner {
        // update reward to min{block.number, endBlock}
        _updateGlobalReward();
        uint256 tokenPerBlock0 = rewardInfo.tokenPerBlock0;
        uint256 tokenPerBlock1 = rewardInfo.tokenPerBlock1;
        if (block.number > endBlock) {
            rewardInfo.tokenPerBlock0 = 0;
            rewardInfo.tokenPerBlock1 = 0;
            endBlock = block.number;
            _updateGlobalReward();
        }
        if (isReward0) {
            tokenPerBlock0 = tokenPerBlock;
        } else {
            tokenPerBlock1 = tokenPerBlock;
        }
        rewardInfo.tokenPerBlock0 = tokenPerBlock0;
        rewardInfo.tokenPerBlock1 = tokenPerBlock1;
    }

    function setRewardEndBlock(uint256 _endBlock) external onlyOwner {
        require(_endBlock >= block.number, "EndBlock Can't Be Ago");
        // update reward to min{block.number, endBlock}
        _updateGlobalReward();
        uint256 tokenPerBlock0 = rewardInfo.tokenPerBlock0;
        uint256 tokenPerBlock1 = rewardInfo.tokenPerBlock1;
        if (block.number > endBlock) {
            rewardInfo.tokenPerBlock0 = 0;
            rewardInfo.tokenPerBlock1 = 0;
            endBlock = block.number;
            _updateGlobalReward();
        }
        rewardInfo.tokenPerBlock0 = tokenPerBlock0;
        rewardInfo.tokenPerBlock1 = tokenPerBlock1;
        endBlock = _endBlock;
    }

    /// @notice when newly create, collect or withdraw a MiningInfo Object, this function 
    ///    must be called
    /// @dev produce reward from lastRewardBlock to min{block.number, endBlock}
    function _updateGlobalReward() private {
        if (block.number <= lastRewardBlock) {
            return;
        }
        if (lastRewardBlock >= endBlock) {
            return;
        }
        uint256 currBlockNumber = block.number;
        if (currBlockNumber > endBlock) {
            currBlockNumber = endBlock;
        }
        if (totalVLiquidity == 0) {
            lastRewardBlock = currBlockNumber;
            return;
        }
        
        uint256 amountReward0 = (currBlockNumber - lastRewardBlock) * rewardInfo.tokenPerBlock0;
        accRewardPerShare0 += MulDivMath.mulDivFloor(
            amountReward0,
            FixedPoints.Q128,
            totalVLiquidity
        );
        
        uint256 amountReward1 = (currBlockNumber - lastRewardBlock) * rewardInfo.tokenPerBlock1;
        accRewardPerShare1 += MulDivMath.mulDivFloor(
            amountReward1,
            FixedPoints.Q128,
            totalVLiquidity
        );
        lastRewardBlock = currBlockNumber;
    }

    function _newMiningInfo(
        MiningInfo storage miningInfo,
        uint256 amountLock,
        uint256 vLiquidity
    ) private {
        _updateGlobalReward();

        miningInfo.amountLock = amountLock;
        miningInfo.vLiquidity = vLiquidity;
        // todo: whether need ceil?
        miningInfo.lastTouchAccRewardPerShare0 = accRewardPerShare0;
        miningInfo.lastTouchAccRewardPerShare1 = accRewardPerShare1;
    }

    /// @dev get MiningInfo objs owned by a user
    /// @param user owner of MiningIDs
    /// @return list of Mining ID
    function getMiningIDList(address user)
        external
        view
        returns (uint256[] memory)
    {
        EnumerableSet.UintSet storage ids = addr2MiningIDs[user];
        // push could not be used in memory array
        // we set the miningIDList into a fixed-length array rather than dynamic
        uint256[] memory miningIDList = new uint256[](ids.length());
        for (uint256 i = 0; i < ids.length(); i++) {
            miningIDList[i] = ids.at(i);
        }
        return miningIDList;
    }

    function _pendingReward(uint256 miningID)
        private
        view
        returns (uint256 amountReward0, uint256 amountReward1)
    {
        MiningInfo memory miningInfo = miningInfos[miningID];
        amountReward0 = MulDivMath.mulDivFloor(
            miningInfo.vLiquidity,
            accRewardPerShare0 - miningInfo.lastTouchAccRewardPerShare0,
            FixedPoints.Q128
        );
        amountReward1 = MulDivMath.mulDivFloor(
            miningInfo.vLiquidity,
            accRewardPerShare1 - miningInfo.lastTouchAccRewardPerShare1,
            FixedPoints.Q128
        );
    }

    /// @dev pending reward of a MiningInfo obj
    /// @param miningID ID to specify MiningInfo
    function pendingReward(uint256 miningID)
        external
        returns (uint256 amountReward0, uint256 amountReward1)
    {
        _updateGlobalReward();
        (amountReward0, amountReward1) = _pendingReward(miningID);
    }

    /// @dev total pending reward of user
    /// @param user address of owner
    function pendingRewards(address user)
        external
        returns (uint256 totPendingReward0, uint256 totPendingReward1)
    {
        EnumerableSet.UintSet storage ids = addr2MiningIDs[user];
        _updateGlobalReward();

        totPendingReward0 = 0;
        totPendingReward1 = 0;
        for (uint256 i = 0; i < ids.length(); i++) {
            (uint256 pendingReward0, uint256 pendingReward1) = _pendingReward(ids.at(i));
            totPendingReward0 += pendingReward0;
            totPendingReward1 += pendingReward1;
        }
    }

    function _transferReward(
        address token, address from, address to, uint256 value, bool emergency
    ) private returns (uint256 actualTransferValue) {
        actualTransferValue = value;
        if (value > 0) {
            if (!emergency) {
                IERC20(token).safeTransferFrom(
                    from,
                    to,
                    value
                );
            } else {
                // check from's balance and allowance
                uint256 allowance = IERC20(token).allowance(from, address(this));
                uint256 balance = IERC20(token).balanceOf(from);
                actualTransferValue = Math.min(actualTransferValue, allowance);
                actualTransferValue = Math.min(actualTransferValue, balance);
                if (actualTransferValue == 0) {
                    return 0;
                }
                // call transferFrom
                (bool success, bytes memory data) = token.call(
                    abi.encodeWithSelector(
                        IERC20.transferFrom.selector,
                        from,
                        to,
                        actualTransferValue
                    )
                );
                if (success && (data.length == 0 || abi.decode(data, (bool)))) {
                    return actualTransferValue;
                } else {
                    return 0;
                }
            }
        }
    }


    /// @dev compute and sending reward of Mining (tokenReward) to user
    ///    note that this function only deals with status corresponding to reward of mining 
    ///    and will not influence NFT of the MiningInfo obj
    /// @param recipient address to receive reward
    /// @param miningInfo MiningInfo obj owned by user
    /// @param emergency if emergency is true and there is no enough tokenReward from its provider for user's reward,
    ///    withdraw other tokens(including NFT of uniswap), and collect reward as much as possible
    ///    when emergency is false, transaction will be reverted if tokenReward is not enough
    /// @return amountReward0 amount of token0 reward sent to recipient
    /// @return amountReward1 amount of token1 reward sent to recipient
    function _collect(
        address recipient,
        MiningInfo storage miningInfo,
        bool emergency
    ) private returns (uint256 amountReward0, uint256 amountReward1) {
        _updateGlobalReward();
        amountReward0 = MulDivMath.mulDivFloor(
            miningInfo.vLiquidity,
            accRewardPerShare0 - miningInfo.lastTouchAccRewardPerShare0,
            FixedPoints.Q128
        );
        amountReward1 = MulDivMath.mulDivFloor(
            miningInfo.vLiquidity, 
            accRewardPerShare1 - miningInfo.lastTouchAccRewardPerShare1, 
            FixedPoints.Q128
        );
        amountReward0 = _transferReward(rewardInfo.token0, rewardInfo.provider0, recipient, amountReward0, emergency);
        amountReward1 = _transferReward(rewardInfo.token1, rewardInfo.provider1, recipient, amountReward1, emergency);
        // collected reward can not be collected again
        miningInfo.lastTouchAccRewardPerShare0 = accRewardPerShare0;
        miningInfo.lastTouchAccRewardPerShare1 = accRewardPerShare1;
    }

    /// @notice this function will be called in the function of withdraw
    /// @dev collect reward of mining to user, and clear MiningInfo obj,
    ///    note that this function only deals with status corresponding to reward of mining 
    ///    and will not influence NFT of the MiningInfo obj
    /// @param recipient address to receive reward
    /// @param miningInfo MiningInfo obj owned by user
    /// @param emergency if emergency is true and there is no enough tokenReward from its provider for user's reward,
    ///    withdraw other tokens(including NFT of uniswap), and collect reward as much as possible
    ///    when emergency is false, transaction will be reverted if tokenReward is not enough
    /// @return amountReward0 amount of token0 reward sent to recipient
    /// @return amountReward1 amount of token1 reward sent to recipient
    /// @return amountLock amount of tokenLock before clear the MiningInfo obj
    ///    note that amount of deposited tokenUni is not necessary to record, because deposited tokenUni or NFT
    ///    will be refund from uniswap
    function _withdraw(
        address recipient,
        MiningInfo storage miningInfo,
        bool emergency
    ) private returns (uint256 amountReward0, uint256 amountReward1, uint256 amountLock) {
        _updateGlobalReward();
        // first, collect reward0 and reward1
        (amountReward0, amountReward1) = _collect(recipient, miningInfo, emergency);
        // second, refund locked tokens
        amountLock = miningInfo.amountLock;
        if (amountLock > 0) {
            IERC20(tokenLock).safeTransfer(recipient, amountLock);
        }
        // third, clear miningInfo
        miningInfo.amountLock = 0;
        miningInfo.vLiquidity = 0;
    }

    function _tickFloor(int24 tick, int24 tickSpacing)
        private
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

    function _tickUpper(int24 tick, int24 tickSpacing)
        private
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

    struct TickRange {
        int24 tickLeft;
        int24 tickRight;
    }

    /// @dev get sqrtPrice of pool(tokenUni/tokenSwap/fee)
    ///    and compute tick range converted from [PriceUni * 0.5, PriceUni]
    /// @return sqrtPriceX96 current sqrtprice value viewed from uniswap pool, is a 96-bit fixed point number
    ///    note this value might mean price of tokenLock/tokenUni (if tokenUni < tokenLock)
    ///    or price of tokenUni / tokenLock (if tokenUni > tokenLock)
    /// @return tickRange computed tick range
    function _getPriceAndTickRange() private view returns (uint160 sqrtPriceX96, TickRange memory tickRange) {
        (int24 avgTick, uint160 avgSqrtPriceX96, int24 currTick, uint160 currSqrtPriceX96) = swapPool.getAvgTickPriceWithinHour();
        int24 tickSpacing = IUniswapV3Factory(uniFactory).feeAmountTickSpacing(
            fee
        );
        if (tokenUni < tokenLock) {
            // price is tokenLock / tokenUni
            // tokenUni is X
            tickRange.tickLeft = currTick + 1;
            sqrtPriceX96 = currSqrtPriceX96;
            if (tickRange.tickLeft < avgTick) {
                tickRange.tickLeft = avgTick;
                sqrtPriceX96 = avgSqrtPriceX96;
            }
            uint256 sqrtDoublePriceX96 = (uint256(sqrtPriceX96) *
                sqrt2A) / sqrt2B;
            require(uint160(sqrtDoublePriceX96) == sqrtDoublePriceX96, "2p O");
            tickRange.tickRight = LogPowMath.getLogSqrtPriceFloor(
                uint160(sqrtDoublePriceX96)
            );
            tickRange.tickLeft = _tickUpper(tickRange.tickLeft, tickSpacing);
            tickRange.tickRight = _tickUpper(tickRange.tickRight, tickSpacing);
        } else {
            // price is tokenUni / tokenLock
            // tokenUni is Y
            tickRange.tickRight = currTick;
            sqrtPriceX96 = currSqrtPriceX96;
            if (tickRange.tickRight > avgTick) {
                tickRange.tickRight = avgTick;
                sqrtPriceX96 = avgSqrtPriceX96;
            }
            uint256 sqrtHalfPriceX96 = (uint256(sqrtPriceX96) *
                sqrt2B) / sqrt2A;
            require(uint160(sqrtHalfPriceX96) == sqrtHalfPriceX96, "p/2 O");
            tickRange.tickLeft = LogPowMath.getLogSqrtPriceFloor(
                uint160(sqrtHalfPriceX96)
            );
            tickRange.tickLeft = _tickFloor(tickRange.tickLeft, tickSpacing);
            tickRange.tickRight = _tickFloor(tickRange.tickRight, tickSpacing);
        }
        require(tickRange.tickLeft < tickRange.tickRight, "L<R");
    }

    /// @dev compute amount of tokenLock
    /// @param sqrtPriceX96 sqrtprice value viewed from uniswap pool
    /// @param amountUni amount of tokenUni user deposits
    ///    or amount computed corresponding to deposited uniswap NFT
    /// @return amountLock amount of tokenLock
    function _getAmountLock(uint160 sqrtPriceX96, uint256 amountUni)
        private
        view
        returns (uint256 amountLock)
    {
        uint256 priceX96 = MulDivMath.mulDivCeil(
            sqrtPriceX96,
            sqrtPriceX96,
            FixedPoints.Q96
        );
        if (tokenUni < tokenLock) {
            // price is tokenLock / tokenUni
            amountLock = MulDivMath.mulDivCeil(
                amountUni,
                priceX96,
                FixedPoints.Q96
            );
        } else {
            amountLock = MulDivMath.mulDivCeil(
                amountUni,
                FixedPoints.Q96,
                priceX96
            );
        }
    }

    // fill INonfungiblePositionManager.MintParams struct to call INonfungiblePositionManager.mint(...)
    function _mintUniswapParam(
        uint256 amountUni,
        int24 tickLeft,
        int24 tickRight,
        uint256 deadline
    )
        private
        view
        returns (INonfungiblePositionManager.MintParams memory params)
    {
        params.fee = fee;
        params.tickLower = tickLeft;
        params.tickUpper = tickRight;
        params.deadline = deadline;
        params.recipient = address(this);
        if (tokenUni < tokenLock) {
            params.token0 = tokenUni;
            params.token1 = tokenLock;
            params.amount0Desired = amountUni;
            params.amount1Desired = 0;
            params.amount0Min = 1;
            params.amount1Min = 0;
        } else {
            params.token0 = tokenLock;
            params.token1 = tokenUni;
            params.amount0Desired = 0;
            params.amount1Desired = amountUni;
            params.amount0Min = 0;
            params.amount1Min = 1;
        }
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

    // fill INonfungiblePositionManager.DecreaseLiquidityParams struct 
    //    to call INonfungiblePositionManager.decreaseLiquidity(...)
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

    struct PositionData {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    function _getPositionData(uint256 uniPositionID)
        private
        view
        returns (PositionData memory posData)
    {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee_,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,
            ,
            ,
            
        ) = INonfungiblePositionManager(nftManager).positions(uniPositionID);
        posData.token0 = token0;
        posData.token1 = token1;
        posData.fee = fee_;
        posData.tickLower = tickLower;
        posData.tickUpper = tickUpper;
        posData.liquidity = liquidity;
    }

    /// @notice if user call mintWithExistingNFT, this function should be called
    /// @dev check deposited uniswap nft, and compute corresponding amount of uniToken
    ///    the deposited nft should cover the requiredTickRange
    /// @param uniPositionID token id of deposited uniswap nft
    /// @param requiredTickRange required tick range converted from [0.5 * priceUni, priceUni]
    /// @return amountUni amount of tokenUni in requiredTickRange
    function _checkNFTAndGetAmountUni(
        uint256 uniPositionID,
        TickRange memory requiredTickRange
    ) private view returns (uint256 amountUni) {
        PositionData memory posData = _getPositionData(uniPositionID);
        // range of nft should cover required range
        require(posData.tickLower < posData.tickUpper, "L<R");
        require(posData.tickLower <= requiredTickRange.tickLeft, "TL");
        require(posData.tickUpper >= requiredTickRange.tickRight, "TU");
        // liquidity of nft should >0
        require(posData.liquidity > 0, "L>0");

        uint160 sqrtPriceAX96 = LogPowMath.getSqrtPrice(
            requiredTickRange.tickLeft
        );
        uint160 sqrtPriceBX96 = LogPowMath.getSqrtPrice(
            requiredTickRange.tickRight
        );
        if (tokenUni < tokenLock) {
            // tokenUni is token0
            amountUni = AmountMath.getAmount0ForLiquidity(
                sqrtPriceAX96,
                sqrtPriceBX96,
                posData.liquidity
            );
        } else {
            // tokenUni is token1
            amountUni = AmountMath.getAmount1ForLiquidity(
                sqrtPriceAX96,
                sqrtPriceBX96,
                posData.liquidity
            );
        }
    }

    /// @dev Call this interface to mint with existing uniswap NFT
    /// @param uniPositionID token id of the NFT
    /// @param uniMultiplier multiplier of uniAmount, vLiquidity = uniMultiplier * amountUni
    ///    amountUni is computed corresponding to [0.5 * PriceUni, PriceUni] and liquidity of the NFT
    ///    note that amount of tokenLock will also be multiplied
    /// @return miningID is the id of MiningInfo obj created during this calling
    function mintWithExistingNFT(uint256 uniPositionID, uint256 uniMultiplier)
        external
        returns (uint256 miningID)
    {
        require(uniMultiplier < 3, "M<3");
        IERC721(nftManager).safeTransferFrom(
            msg.sender,
            address(this),
            uniPositionID
        );

        (uint160 sqrtPriceX96, TickRange memory tickRange) = _getPriceAndTickRange();
        uint256 amountUni = _checkNFTAndGetAmountUni(uniPositionID, tickRange);
        uint256 amountLock = _getAmountLock(
            sqrtPriceX96,
            amountUni * uniMultiplier
        );

        IERC20(tokenLock).safeTransferFrom(
            address(msg.sender),
            address(this),
            amountLock
        );

        miningID = miningNum++;
        MiningInfo storage miningInfo = miningInfos[miningID];
        // mark isUniPositionIDExternal as true, means the NFT is deposit from user
        // instead of created by this contract. When user calling withdraw(...) in the future
        // this contract will refund this NFT
        miningInfo.isUniPositionIDExternal = true;

        _newMiningInfo(miningInfo, amountLock, amountUni * uniMultiplier);
        totalVLiquidity += amountUni * uniMultiplier;

        addr2MiningIDs[msg.sender].add(miningID);
        miningOwner[miningID] = msg.sender;

        emit Mint(miningID, address(msg.sender), amountUni, amountLock);
    }

    /// @dev Call this interface to mint with tokenUni
    /// @param amountUni amount of tokenUni deposited from user
    /// @param uniMultiplier multiplier of uniAmount, vLiquidity = uniMultiplier * amountUni
    ///    note that amount of tokenLock will also be multiplied
    /// @return miningID is the id of MiningInfo obj created during this calling
    function mint(
        uint256 amountUni,
        uint256 uniMultiplier,
        uint256 deadline
    ) external returns (uint256 miningID) {
        require(uniMultiplier < 3, "M<3");

        IERC20(tokenUni).safeTransferFrom(
            address(msg.sender),
            address(this),
            amountUni
        );

        (uint160 sqrtPriceX96, TickRange memory tickRange) = _getPriceAndTickRange();
        uint256 amountLock = _getAmountLock(
            sqrtPriceX96,
            amountUni * uniMultiplier
        );
        IERC20(tokenLock).safeTransferFrom(
            address(msg.sender),
            address(this),
            amountLock
        );

        miningID = miningNum++;
        MiningInfo storage miningInfo = miningInfos[miningID];

        IERC20(tokenUni).safeApprove(nftManager, amountUni);
        INonfungiblePositionManager.MintParams
            memory uniParams = _mintUniswapParam(
                amountUni,
                tickRange.tickLeft,
                tickRange.tickRight,
                deadline
            );
        uint256 actualAmountUni;
        // mark isUniPositionIDExternal as false, means the uniswap NFT is created by
        // this contract. When user calling withdraw(...) in the future
        // this contract will decrease the liquidity of NFT to 0
        // and refund corresponding tokenUni and tokenSwap from uniswap
        miningInfo.isUniPositionIDExternal = false;

        if (tokenUni < tokenLock) {
            uint256 amount1;
            (
                miningInfo.uniPositionID,
                miningInfo.uniLiquidity,
                actualAmountUni,
                amount1
            ) = INonfungiblePositionManager(nftManager).mint(uniParams);
            require(actualAmountUni <= amountUni, "Uniswap ActualUni Exceed!");
            require(amount1 == 0, "Uniswap No AmountStaking!");
        } else {
            uint256 amount0;
            (
                miningInfo.uniPositionID,
                miningInfo.uniLiquidity,
                amount0,
                actualAmountUni
            ) = INonfungiblePositionManager(nftManager).mint(uniParams);
            require(actualAmountUni <= amountUni, "Uniswap ActualUni Exceed!");
            require(amount0 == 0, "Uniswap No AmountStaking!");
        }
        IERC20(tokenUni).safeApprove(nftManager, 0);
        if (actualAmountUni < amountUni) {
            // refund
            IERC20(tokenUni).safeTransfer(
                address(msg.sender),
                amountUni - actualAmountUni
            );
        }
        _newMiningInfo(miningInfo, amountLock, actualAmountUni * uniMultiplier);
        totalVLiquidity += actualAmountUni * uniMultiplier;

        addr2MiningIDs[msg.sender].add(miningID);
        miningOwner[miningID] = msg.sender;

        emit Mint(miningID, address(msg.sender), actualAmountUni, amountLock);
    }

    /// @dev Call this interface to collect reward token and swap fee from uniswap
    /// @param miningID ID of MiningInfo obj
    /// @param recipient address to receive reward and swap fee
    /// @return amountUni amount of tokenUni (fee from uniswap) received by recipient
    /// @return amountLock amount of tokenLock (fee from uniswap) received by recipient
    /// @return amountReward0 amount of mining reward0 recieved by recipient
    /// @return amountReward1 amount of mining reward1 recieved by recipient
    function collect(uint256 miningID, address recipient)
        external
        checkMiningOwner(miningID)
        returns (
            uint256 amountUni,
            uint256 amountLock,
            uint256 amountReward0,
            uint256 amountReward1
        )
    {
        if (recipient == address(0)) {
            recipient = msg.sender;
        }
        MiningInfo storage miningInfo = miningInfos[miningID];

        // collect 2 rewards of mining
        (amountReward0, amountReward1) = _collect(recipient, miningInfo, false);

        INonfungiblePositionManager.CollectParams
            memory params = _collectUniswapParam(
                miningInfo.uniPositionID,
                recipient
            );

        // collect swap fee from uniswap
        if (tokenUni < tokenLock) {
            (amountUni, amountLock) = INonfungiblePositionManager(nftManager)
                .collect(params);
        } else {
            (amountLock, amountUni) = INonfungiblePositionManager(nftManager)
                .collect(params);
        }

        emit Collect(miningID, recipient, amountUni, amountLock, amountReward0, amountReward1);
    }

    /// @dev Call this interface to withdraw tokenLock with its reward (tokenReward), and deposited (tokenUni/uniNFT) with its fee
    /// @param miningID id of mining to withdraw
    /// @param recipient address specified to receive all tokens(including NFT of uniswap), if recipient is zero, 
    ///    all tokens(including NFT of uniswap) will be transfered to 'msg.sender'
    /// @param deadline deadline to call "decreaseLiquidity" of uniswap
    /// @param emergency if emergency is true and there is no enough tokenReward from its provider for user's reward,
    ///    withdraw other tokens(including NFT of uniswap), and collect reward as much as possible
    ///    when emergency is false, transaction will be reverted if tokenReward is not enough
    /// @return amountUni amount of tokenUni refund to address 'recipient' or msg.sender,
    ///    if user deposit NFT instead of tokenUni when calling mint(...), amountUni will be zero
    /// @return amountLock amount of tokenLock refund to address 'recipient' or msg.sender
    /// @return amountReward0 amount of reward0 transfered to address 'recipient' or msg.sender
    /// @return amountReward1 amount of reward1 transfered to address 'recipient' or msg.sender
    function withdraw(
        uint256 miningID,
        address recipient,
        uint256 deadline,
        bool emergency
    )
        external
        checkMiningOwner(miningID)
        returns (
            uint256 amountUni,
            uint256 amountLock,
            uint256 amountReward0,
            uint256 amountReward1
        )
    {
        if (recipient == address(0)) {
            recipient = msg.sender;
        }
        MiningInfo storage miningInfo = miningInfos[miningID];

        uint256 amountUniFromSwap = 0;
        uint256 amountLockFromSwap = 0;

        if (!miningInfo.isUniPositionIDExternal) {
            // collect swap fee and withdraw tokenUni tokenLock from uniswap
            INonfungiblePositionManager.DecreaseLiquidityParams
                memory decUniParams = _withdrawUniswapParam(
                    miningInfo.uniPositionID,
                    miningInfo.uniLiquidity,
                    deadline
                );
            INonfungiblePositionManager.CollectParams
                memory collectUniParams = _collectUniswapParam(
                    miningInfo.uniPositionID,
                    recipient
                );
            if (tokenUni < tokenLock) {
                INonfungiblePositionManager(nftManager).decreaseLiquidity(
                    decUniParams
                );
                (
                    amountUniFromSwap,
                    amountLockFromSwap
                ) = INonfungiblePositionManager(nftManager).collect(
                    collectUniParams
                );
            } else {
                INonfungiblePositionManager(nftManager).decreaseLiquidity(
                    decUniParams
                );
                (
                    amountLockFromSwap,
                    amountUniFromSwap
                ) = INonfungiblePositionManager(nftManager).collect(
                    collectUniParams
                );
            }
        } else {
            // send deposited NFT to user
            IERC721(nftManager).safeTransferFrom(
                address(this),
                recipient,
                miningInfo.uniPositionID
            );
        }
        miningInfo.uniLiquidity = 0;

        // withdraw mining
        (amountReward0, amountReward1, amountLock) = _withdraw(
            recipient,
            miningInfo,
            emergency
        );

        amountUni = amountUniFromSwap;
        amountLock += amountLockFromSwap;

        addr2MiningIDs[msg.sender].remove(miningID);
        emit Withdraw(miningID, recipient, amountUni, amountLock, amountReward0, amountReward1);
    }
}