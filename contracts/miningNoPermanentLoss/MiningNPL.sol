pragma solidity ^0.8.4;
import "./utils.sol";
import "./Staking.sol";
import "./LogPowMath.sol";
import "./MulDivMath.sol";
import "./interfaces.sol";
import "hardhat/console.sol";

contract MiningNPL is Ownable{

    using SafeERC20 for IERC20;
        
    struct UserMiningInfo {

        // uint256 stakingAmount;
        // uint256 stakingRewardDebt;
        // uint256 stakingPending;

        uint256 pledgeAmount;
        uint256 uniMultiplier;
        uint256 uniAmount;
        uint256 uniRewardDebt;
        uint256 uniRewardPending;
        uint256 pledgePending;

        uint256 uniPositionID;
        uint128 uniLiquidity;
    }
    
    // address public staking;
    address public tokenPledge;
    address public tokenUni;
    uint24 public fee;

    struct UniRewardParam {
        address token;
        address provider;
        uint256 tokenPerBlock;
        uint256 startBlock;
        uint256 lastRewardBlock;
        uint256 BONUS_MULTIPLIER;
    }

    struct UniRewardInfo {
        address token;
        address provider;
        uint256 tokenPerBlock;
        uint256 startBlock;
        uint256 lastRewardBlock;
        uint256 BONUS_MULTIPLIER;
        uint256 stakingAmount;
        uint256 accTokenPerShare;
    }

    UniRewardInfo public uniRewardInfo;

    uint256 public userMiningNum = 0;
    address public weth;
    address public nftManager;
    address public uniFactory;
    uint256 internal constant sqrt2A = 141421;
    uint256 internal constant sqrt2B = 100000;
    uint256 internal constant Q96 = 0x1000000000000000000000000;
    mapping (uint256 => address) public userMiningOwner;
    mapping (uint256 => UserMiningInfo) public userMiningInfo;

    event Mint(uint256 indexed miningID, address indexed owner, uint256 amountUni, uint256 amountPledge);
    event Collect(uint256 indexed miningID, address indexed recipient, uint256 amountUni, uint256 amountPledge, uint256 amountUniReward);
    event Withdraw(uint256 indexed miningID, uint256 amountUni, uint256 amountPledge);

    constructor(
        address tokenUniAddr,
        address tokenPledgeAddr,
        uint24 swapFee,
        address nfPositionManager,
        UniRewardParam memory uniRewardParam
    ) {
        tokenUni = tokenUniAddr;
        tokenPledgeAddr = tokenPledge;
        fee = swapFee;

        nftManager = nfPositionManager;
        weth = INonfungiblePositionManager(nfPositionManager).WETH9();
        uniFactory = INonfungiblePositionManager(nfPositionManager).factory();

        uniRewardInfo.token = uniRewardParam.token;
        uniRewardInfo.provider = uniRewardParam.provider;
        uniRewardInfo.tokenPerBlock = uniRewardParam.tokenPerBlock;
        uniRewardInfo.startBlock = uniRewardParam.startBlock;
        uniRewardInfo.lastRewardBlock = uniRewardParam.lastRewardBlock;
        uniRewardInfo.BONUS_MULTIPLIER = uniRewardParam.BONUS_MULTIPLIER;

        uniRewardInfo.stakingAmount = 0;
        uniRewardInfo.accTokenPerShare = 0;
    }

    modifier checkMiningOwner(uint256 userMiningID) {
        require(userMiningOwner[userMiningID] == msg.sender, "Not Owner!");
        _;
    }

    function setUniRewardProvider(
        address uniRewardProvider
    ) external onlyOwner {
        uniRewardInfo.provider = uniRewardProvider;
    }

    function updateUniRewardInfo(UniRewardInfo storage uniInfo) private {
        if (block.number <= uniInfo.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = uniInfo.stakingAmount;
        if (lpSupply == 0) {
            uniInfo.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = (block.number - uniInfo.lastRewardBlock) * uniInfo.BONUS_MULTIPLIER;
        uint256 tokenReward = multiplier * uniInfo.tokenPerBlock;
        uniInfo.accTokenPerShare = uniInfo.accTokenPerShare + tokenReward * 1e12 / lpSupply;
        uniInfo.lastRewardBlock = block.number;
    }
    function newMiningInfo(UserMiningInfo storage user, uint256 pledgeAmount, uint256 uniAmount, uint256 uniMultiplier) private {
        updateUniRewardInfo(uniRewardInfo);
        
        user.pledgeAmount = pledgeAmount;
        user.uniMultiplier = uniMultiplier;
        user.uniAmount = uniAmount;
        user.uniRewardDebt = uniAmount * uniMultiplier * uniRewardInfo.accTokenPerShare / 1e12;
        user.uniRewardPending = 0;
    }
    function updateMiningInfo(UserMiningInfo storage user) private {
        updateUniRewardInfo(uniRewardInfo);

        if (user.uniAmount > 0) {
            uint256 pending = user.uniAmount * user.uniMultiplier * uniRewardInfo.accTokenPerShare / 1e12 - user.uniRewardDebt;
            if (pending > 0) {
                user.uniRewardPending += pending;
            }
        }
        user.uniRewardDebt = user.uniAmount * user.uniMultiplier * uniRewardInfo.accTokenPerShare / 1e12;
    }
    function withdrawMining(
        UserMiningInfo storage user
    ) private returns(
        uint256 pledgeAmount
    ) {
        updateMiningInfo(user);
        uint256 uniAmount = user.uniAmount;
        pledgeAmount = user.pledgeAmount;
        if (uniAmount > 0 || pledgeAmount > 0) {
            user.pledgePending += pledgeAmount;
            user.uniAmount = 0;
            user.pledgeAmount = 0;
            user.uniRewardDebt = 0;
        }
    }
    function collectMining(
        address recipient,
        UserMiningInfo storage user
    ) private returns(
        uint256 uniReward,
        uint256 pledge
    ) {
        updateMiningInfo(user);
        uniReward = user.uniRewardPending;
        pledge = user.pledgePending;
        if (uniReward > 0 || pledge > 0) {
            user.uniRewardPending = 0;
            user.pledgePending = 0;
            if (uniReward > 0) {
                IERC20(uniRewardInfo.token).safeTransferFrom(uniRewardInfo.provider, recipient, uniReward);
            }
            if (pledge > 0) {
                IERC20(tokenPledge).safeTransfer(recipient, pledge);
            }
        }
    }
    function getTickPrice(
        address pool
    ) private view returns(int24 tick, uint160 sqrtPriceX96) {
        (
            uint160 sqrtPriceX96_,
            int24 tick_,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        ) = IUniswapV3Pool(pool).slot0();
        tick = tick_;
        sqrtPriceX96 = sqrtPriceX96_;
    }
    function tickFloor(int24 tick, int24 tickSpacing) private pure returns(int24) {
        int24 c = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) {
            c = c - 1;
        }
        c = c * tickSpacing;
        return c;
    }
    function tickUpper(int24 tick, int24 tickSpacing) private pure returns(int24) {
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
        uint160 sqrtPriceX96;
    }
    function getTickRange(
        address tokenUni,
        address tokenPledge,
        uint24 fee
    ) private view returns(TickRange memory tickRange) {
        address pool = IUniswapV3Factory(uniFactory).getPool(tokenPledge, tokenUni, fee);
        require(pool != address(0), "No Uniswap Pool!");
        int24 tick;
        (tick, tickRange.sqrtPriceX96) = getTickPrice(pool);
        int24 tickSpacing = IUniswapV3Factory(uniFactory).feeAmountTickSpacing(fee);
        if (tokenUni < tokenPledge) {
            // price is tokenPledge / tokenUni
            // tokenUni is X
            tickRange.tickLeft = tick + 1;
            uint256 sqrtDoublePriceX96 = uint256(tickRange.sqrtPriceX96) * sqrt2A / sqrt2B;
            require(uint160(sqrtDoublePriceX96) == sqrtDoublePriceX96, "2p O");
            tickRange.tickRight = LogPowMath.getLogSqrtPriceFloor(uint160(sqrtDoublePriceX96));
            tickRange.tickLeft = tickUpper(tickRange.tickLeft, tickSpacing);
            tickRange.tickRight = tickUpper(tickRange.tickRight, tickSpacing);
        } else {
            // price is tokenUni / tokenPledge
            // tokenUni is Y
            tickRange.tickRight = tick;
            uint256 sqrtHalfPriceX96 = uint256(tickRange.sqrtPriceX96) * sqrt2B / sqrt2A;
            require(uint160(sqrtHalfPriceX96) == sqrtHalfPriceX96, "p/2 O");
            tickRange.tickLeft = LogPowMath.getLogSqrtPriceFloor(uint160(sqrtHalfPriceX96));
            tickRange.tickLeft = tickFloor(tickRange.tickLeft, tickSpacing);
            tickRange.tickRight = tickFloor(tickRange.tickRight, tickSpacing);
        }
        require(tickRange.tickLeft < tickRange.tickRight, "L<R");
    }
    function getAmountPledge(
        address tokenUni,
        address tokenPledge,
        uint160 sqrtPriceX96,
        uint256 amountUni
    ) private pure returns(uint256 amountPledge) {
        uint256 priceX96 = MulDivMath.mulDivCeil(sqrtPriceX96, sqrtPriceX96, Q96);
        if (tokenUni < tokenPledge) {
            // price is tokenPledge / tokenUni
            amountPledge = MulDivMath.mulDivCeil(amountUni, priceX96, Q96);
        } else {
            amountPledge = MulDivMath.mulDivCeil(amountUni, Q96, priceX96);
        }
    }
    function mintUniswapParam(
        address tokenUni, 
        address tokenPledge, 
        uint256 amountUni, 
        uint24 fee, 
        int24 tickLeft, 
        int24 tickRight, 
        uint256 deadline
    ) private view returns(INonfungiblePositionManager.MintParams memory params) {
        params.fee = fee;
        params.tickLower = tickLeft;
        params.tickUpper = tickRight;
        params.deadline = deadline;
        params.recipient = address(this);
        if (tokenUni < tokenPledge) {
            params.token0 = tokenUni;
            params.token1 = tokenPledge;
            params.amount0Desired = amountUni;
            params.amount1Desired = 0;
            params.amount0Min = 1;
            params.amount1Min = 0;
        } else {
            params.token0 = tokenPledge;
            params.token1 = tokenUni;
            params.amount0Desired = 0;
            params.amount1Desired = amountUni;
            params.amount0Min = 0;
            params.amount1Min = 1;
        }
    }
    function collectUniswapParam(
        uint256 uniPositionID,
        address recipient
    ) private pure returns(INonfungiblePositionManager.CollectParams memory params) {
        params.tokenId = uniPositionID;
        params.recipient = recipient;
        params.amount0Max = 0xffffffffffffffffffffffffffffffff;
        params.amount1Max = 0xffffffffffffffffffffffffffffffff;
    }
    function withdrawUniswapParam(
        uint256 uniPositionID,
        uint128 liquidity,
        uint256 deadline
    ) private pure returns(INonfungiblePositionManager.DecreaseLiquidityParams memory params) {
        params.tokenId = uniPositionID;
        params.liquidity = liquidity;
        params.amount0Min = 0;
        params.amount1Min = 0;
        params.deadline = deadline;
    }
    
    function mint(
        uint256 amountUni,
        uint256 uniMultiplier,
        uint256 deadline
    ) external returns(uint256 userMiningID){
        
        IERC20(tokenUni).safeTransferFrom(address(msg.sender), address(this), amountUni);

        TickRange memory tickRange = getTickRange(tokenUni, tokenPledge, fee);
        uint256 amountPledge = getAmountPledge(tokenUni, tokenPledge, tickRange.sqrtPriceX96, amountUni);
        IERC20(tokenPledge).safeTransferFrom(address(msg.sender), address(this), amountPledge);

        userMiningID = userMiningNum;
        userMiningNum ++;
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];
        
        IERC20(tokenUni).safeApprove(nftManager, amountUni);
        INonfungiblePositionManager.MintParams memory uniParams = mintUniswapParam(
            tokenUni,
            tokenPledge,
            amountUni,
            fee,
            tickRange.tickLeft,
            tickRange.tickRight,
            deadline
        );
        uint256 actualAmountUni;
        
        if (tokenUni < tokenPledge) {
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
            IERC20(tokenUni).safeTransfer(address(msg.sender), amountUni - actualAmountUni);
        }
        newMiningInfo(miningInfo, amountPledge, amountUni, uniMultiplier);

        emit Mint(userMiningID, address(msg.sender), actualAmountUni, amountPledge);
    }
    function collect(
        uint256 userMiningID, 
        address recipient
    ) external checkMiningOwner(userMiningID) returns(uint256 amountUni, uint256 amountPledge, uint256 amountUniReward)
    {
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];

        (uint256 amountUniReward, uint256 pledge) = collectMining(recipient, miningInfo);

        INonfungiblePositionManager.CollectParams memory params = collectUniswapParam(
            miningInfo.uniPositionID,
            recipient
        );

        if (tokenUni < tokenPledge) {
            (amountUni, amountPledge) = INonfungiblePositionManager(nftManager).collect(params);
        } else {
            (amountPledge, amountUni) = INonfungiblePositionManager(nftManager).collect(params);
        }
        amountPledge += pledge;

        emit Collect(userMiningID, recipient, amountUni, amountPledge, amountUniReward);
    }
    function withdraw(
        uint256 userMiningID,
        uint256 deadline
    ) external checkMiningOwner(userMiningID) returns(uint256 amountUni, uint256 amountPledge) {
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];

        uint256 pledge = withdrawMining(miningInfo);

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = withdrawUniswapParam(
            miningInfo.uniPositionID,
            miningInfo.uniLiquidity,
            deadline
        );

        if (tokenUni < tokenPledge) {
            (amountUni, amountPledge) = INonfungiblePositionManager(nftManager).decreaseLiquidity(params);
        } else {
            (amountPledge, amountUni) = INonfungiblePositionManager(nftManager).decreaseLiquidity(params);
        }
        miningInfo.uniLiquidity = 0;

        amountPledge += pledge;
        emit Withdraw(userMiningID, amountUni, amountPledge);
    }
}