pragma solidity ^0.8.4;
import "./utils.sol";
import "./Staking.sol";
import "./LogPowMath.sol";
import "./MulDivMath.sol";
import "./interfaces.sol";


contract Main is Ownable{

    using SafeBEP20 for IBEP20;
    
    mapping (address => address) public token2Staking;
    
    struct UserMiningInfo {
        address tokenStaking;
        address tokenUni;

        uint256 stakingAmount;
        uint256 stakingRewardDebt;
        uint256 stakingPending;

        uint256 uniStakingAmount;
        uint256 uniStakingRewardDebt;
        uint256 uniStakingAccuralPending;

        uint256 uniPositionID;
        uint128 uniLiquidity;
    }
    struct UniStakingPoolInfo {
        address tokenProvider;
        uint256 tokenPerBlock;
        uint256 startBlock;
        uint256 accTokenPerShare;
        uint256 lastRewardBlock;
        uint256 stakeAmount;
        uint256 BONUS_MULTPLIER;
        bool inited;
    }
    mapping (address => UniStakingPoolInfo) public uniStakingPoolInfo;
    mapping (address => address) public stakingPool;
    uint256 userMiningNum = 0;
    address weth;
    address nftManager;
    address uniFactory;
    uint256 internal constant sqrt2A = 141421;
    uint256 internal constant sqrt2B = 100000;
    uint256 internal constant Q96 = 0x1000000000000000000000000;
    mapping (uint256 => address) userMiningOwner;
    mapping (uint256 => UserMiningInfo) userMiningInfo;



    event Mint(uint256 indexed miningID, address indexed owner, uint256 amountUni, uint256 amountStaking);
    event Collect(uint256 indexed miningID, address indexed recipient, uint256 amountUni, uint256 amountStaking);
    event Withdraw(uint256 indexed miningID, uint256 amountUni, uint256 amountStaking);

    constructor(address nfPositionManager) {
        nftManager = nfPositionManager;
        weth = INonfungiblePositionManager(nfPositionManager).WETH9();
        uniFactory = INonfungiblePositionManager(nfPositionManager).factory();
    }

    modifier checkMiningOwner(uint256 userMiningID) {
        require(userMiningOwner[userMiningID] == msg.sender, "Not Owner!");
        _;
    }

    function setUniStakingPoolInfo(
        address tokenUni,
        address tokenProvider,
        uint256 tokenPerBlock,
        uint256 startBlock,
        uint256 bonusMultiplier
    ) external onlyOwner {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[tokenUni];
        poolInfo.tokenProvider = tokenProvider;
        poolInfo.tokenPerBlock = tokenPerBlock;
        poolInfo.startBlock = startBlock;
        poolInfo.lastRewardBlock = startBlock;
        poolInfo.BONUS_MULTPLIER = bonusMultiplier;
        poolInfo.stakeAmount = 0;
        poolInfo.inited = true;
    }
    function setStakingPool(
        address token,
        address staking
    ) external onlyOwner {
        require(IStaking(staking).token() == token, "TKM");
        stakingPool[token] = staking;
    }
    function depositStaking(UserMiningInfo storage user, address staking, uint256 _amount) private {
        IStaking(staking).deposit(_amount);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if (pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (_amount > 0) {
            user.stakingAmount = user.stakingAmount + _amount;
        }
        user.stakingRewardDebt = user.stakingAmount * accTokenPerShare / 1e12;
    }
    function updateUniPool(UniStakingPoolInfo storage poolInfo) private {
        if (block.number <= poolInfo.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = poolInfo.stakeAmount;
        if (lpSupply == 0) {
            poolInfo.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = (block.number - poolInfo.lastRewardBlock) * poolInfo.BONUS_MULTPLIER;
        uint256 tokenReward = multiplier * poolInfo.tokenPerBlock;
        poolInfo.accTokenPerShare = poolInfo.accTokenPerShare + tokenReward * 1e12 / lpSupply;
        poolInfo.lastRewardBlock = block.number;
    }
    function depositUniStaking(UserMiningInfo storage user, uint256 _amount) private {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[user.tokenUni];
        updateUniPool(poolInfo);
        if (user.uniStakingAmount > 0) {
            uint256 pending = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12 - user.uniStakingRewardDebt;
            if (pending > 0) {
                user.uniStakingAccuralPending += pending;
            }
        }
        if (_amount > 0) {
            user.uniStakingAmount += _amount;
            poolInfo.stakeAmount += _amount;
        }
        user.uniStakingRewardDebt = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12;
    }
    function withdrawStaking(UserMiningInfo storage user, address staking, uint256 _amount) private {
        require(user.stakingAmount >= _amount, "withdraw: not enough!");
        IStaking(staking).withdraw(_amount);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if (pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (_amount > 0) {
            user.stakingAmount = user.stakingAmount - _amount;
            user.stakingPending = user.stakingPending + _amount;
        }
        user.stakingRewardDebt = user.stakingAmount * accTokenPerShare / 1e12;
    }
    function withdrawUniStaking(UserMiningInfo storage user, uint256 _amount) private {
        UniStakingPoolInfo storage poolInfo = uniStakingPoolInfo[user.tokenUni];
        require(user.uniStakingAmount >= _amount, "withdraw: not enough!");
        updateUniPool(poolInfo);
        uint256 pending = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12 - user.uniStakingRewardDebt;
        if (pending > 0) {
            user.uniStakingAccuralPending += pending;
        }
        if (_amount > 0) {
            user.uniStakingAmount = user.uniStakingAmount - _amount;
            poolInfo.stakeAmount = poolInfo.stakeAmount - _amount;
            // we do not add _amount to uniStakingAccuralPending because _amount will be added in uniswap remainToken
        }
        user.uniStakingRewardDebt = user.uniStakingAmount * poolInfo.accTokenPerShare / 1e12;
    }
    function collectStaking(
        address recipient,
        UserMiningInfo storage user,
        address staking,
        uint256 limit
    ) private returns(uint256 collected) {
        IStaking(staking).withdraw(0);
        uint256 accTokenPerShare = IStaking(staking).accTokenPerShare();
        uint256 pending = user.stakingAmount * accTokenPerShare / 1e12 - user.stakingRewardDebt;
        if(pending > 0) {
            user.stakingPending = user.stakingPending + pending;
        }
        if (limit == 0) {
            limit = user.stakingPending;
        }
        if (limit > user.stakingPending) {
            limit = user.stakingPending;
        }
        collected = 0;
        if (limit > 0) {
            collected = IStaking(staking).collect(recipient, limit);
            user.stakingPending -= limit;
        }
    }
    function collectUniStaking(
        address recipient,
        UserMiningInfo storage user,
        uint256 limit
    ) private returns(uint256 collected) {
        withdrawUniStaking(user, 0);
        if (limit == 0) {
            limit = user.uniStakingAccuralPending;
        }
        if (limit > user.uniStakingAccuralPending) {
            limit = user.uniStakingAccuralPending;
        }
        collected = limit;
        if (collected > 0) {
            UniStakingPoolInfo memory poolInfo = uniStakingPoolInfo[user.tokenUni];
            address tokenUniProvider = poolInfo.tokenProvider;
            IBEP20(user.tokenUni).safeTransferFrom(tokenUniProvider, recipient, collected);
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
        address tokenStaking,
        uint24 fee
    ) private view returns(TickRange memory tickRange) {
        address pool = IUniswapV3Factory(uniFactory).getPool(tokenStaking, tokenUni, fee);
        require(pool != address(0), "No Uniswap Pool!");
        int24 tick;
        (tick, tickRange.sqrtPriceX96) = getTickPrice(pool);
        int24 tickSpacing = IUniswapV3Factory(uniFactory).feeAmountTickSpacing(fee);
        if (tokenUni < tokenStaking) {
            tickRange.tickRight = tick;
            uint256 sqrtHalfPriceX96 = uint256(tickRange.sqrtPriceX96) * sqrt2B / sqrt2A;
            require(uint160(sqrtHalfPriceX96) == sqrtHalfPriceX96, "p/2 O");
            tickRange.tickLeft = LogPowMath.getLogSqrtPriceFloor(uint160(sqrtHalfPriceX96));
            tickRange.tickRight = tickFloor(tickRange.tickRight, tickSpacing);
            tickRange.tickLeft = tickFloor(tickRange.tickLeft, tickSpacing);
        } else {
            tickRange.tickLeft = tick;
            uint256 sqrtDoublePriceX96 = uint256(tickRange.sqrtPriceX96) * sqrt2A / sqrt2B;
            require(uint160(sqrtDoublePriceX96) == sqrtDoublePriceX96, "2p O");
            tickRange.tickRight = LogPowMath.getLogSqrtPriceFloor(uint160(sqrtDoublePriceX96));
            tickRange.tickLeft = tickUpper(tickRange.tickLeft, tickSpacing);
            tickRange.tickRight = tickUpper(tickRange.tickRight, tickSpacing);
        }
        require(tickRange.tickLeft < tickRange.tickRight, "L<R");
    }
    function getAmountStaking(
        address tokenUni,
        address tokenStaking,
        uint160 sqrtPriceX96,
        uint256 amountUni
    ) private pure returns(uint256 amountStaking) {
        uint256 priceX96 = MulDivMath.mulDivCeil(sqrtPriceX96, sqrtPriceX96, Q96);
        if (tokenUni < tokenStaking) {
            amountStaking = MulDivMath.mulDivCeil(amountUni, Q96, priceX96);
        } else {
            amountStaking = MulDivMath.mulDivCeil(amountUni, priceX96, Q96);
        }
    }
    function mintUniswapParam(
        address tokenUni, 
        address tokenStaking, 
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
        if (tokenUni < tokenStaking) {
            params.token0 = tokenUni;
            params.token1 = tokenStaking;
            params.amount0Desired = amountUni;
            params.amount1Desired = 0;
            params.amount0Min = 1;
            params.amount1Min = 0;
        } else {
            params.token0 = tokenStaking;
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
    struct MintParams {
        address tokenUni;
        address tokenStaking;
        uint24 fee;
        uint256 amountUni;
        uint256 deadline;
    }
    function mint(
        MintParams calldata params
    ) external payable returns(uint256 userMiningID){
        require(params.tokenUni != weth, "Weth Not Support Now!");
        require(params.tokenStaking != weth, "Weth Not Support Now!");
        require(params.tokenUni != params.tokenStaking, "Same Token!");
        address staking = stakingPool[params.tokenStaking];
        require(staking != address(0), "No Staking Pool!");
        UniStakingPoolInfo storage uniPoolInfo = uniStakingPoolInfo[params.tokenUni];
        require(uniPoolInfo.inited, "No Uni Staking Pool!");

        IBEP20(params.tokenUni).safeTransferFrom(address(msg.sender), address(this), params.amountUni);

        TickRange memory tickRange = getTickRange(params.tokenUni, params.tokenStaking, params.fee);
        uint256 amountStaking = getAmountStaking(params.tokenUni, params.tokenStaking, tickRange.sqrtPriceX96, params.amountUni);
        IBEP20(params.tokenStaking).safeTransferFrom(address(msg.sender), address(this), amountStaking);

        userMiningID = userMiningNum;
        userMiningNum ++;
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];
        miningInfo.tokenUni = params.tokenUni;
        miningInfo.tokenStaking = params.tokenStaking;
        depositStaking(miningInfo, staking, amountStaking);

        IBEP20(params.tokenUni).safeApprove(nftManager, params.amountUni);
        INonfungiblePositionManager.MintParams memory uniParams = mintUniswapParam(
            params.tokenUni,
            params.tokenStaking,
            params.amountUni,
            params.fee,
            tickRange.tickLeft,
            tickRange.tickRight,
            params.deadline
        );
        uint256 actualAmountUni;
        
        if (params.tokenUni < params.tokenStaking) {
            uint256 amount1;
            (
                miningInfo.uniPositionID,
                miningInfo.uniLiquidity,
                actualAmountUni,
                amount1
            ) = INonfungiblePositionManager(nftManager).mint(uniParams);
            require(actualAmountUni <= params.amountUni, "Uniswap ActualUni Exceed!");
            require(amount1 == 0, "Uniswap No AmountStaking!");
        } else {
            uint256 amount0;
            (
                miningInfo.uniPositionID,
                miningInfo.uniLiquidity,
                amount0,
                actualAmountUni
            ) = INonfungiblePositionManager(nftManager).mint(uniParams);
            require(actualAmountUni <= params.amountUni, "Uniswap ActualUni Exceed!");
            require(amount0 == 0, "Uniswap No AmountStaking!");
        }
        IBEP20(params.tokenUni).safeApprove(nftManager, 0);
        if (actualAmountUni < params.amountUni) {
            // refund
            IBEP20(params.tokenUni).safeTransfer(address(msg.sender), params.amountUni - actualAmountUni);
        }
        depositUniStaking(miningInfo, actualAmountUni);

        emit Mint(userMiningID, address(msg.sender), actualAmountUni, amountStaking);
    }
    function collect(
        uint256 userMiningID, address recipient
    ) external checkMiningOwner(userMiningID) returns(uint256 amountUni, uint256 amountStaking)
    {
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];
        
        uint256 stakingCollect = collectStaking(recipient, miningInfo, stakingPool[miningInfo.tokenStaking], 0);
        uint256 uniCollect = collectUniStaking(recipient, miningInfo, 0);
        INonfungiblePositionManager.CollectParams memory params = collectUniswapParam(
            miningInfo.uniPositionID,
            recipient
        );

        if (miningInfo.tokenUni < miningInfo.tokenStaking) {
            (amountUni, amountStaking) = INonfungiblePositionManager(nftManager).collect(params);
        } else {
            (amountStaking, amountUni) = INonfungiblePositionManager(nftManager).collect(params);
        }
        
        amountUni += uniCollect;
        amountStaking += stakingCollect;

        emit Collect(userMiningID, recipient, amountUni, amountStaking);
    }
    function withdraw(
        uint256 userMiningID,
        uint256 deadline
    ) external payable checkMiningOwner(userMiningID) returns(uint256 amountUni, uint256 amountStaking) {
        UserMiningInfo storage miningInfo = userMiningInfo[userMiningID];

        uint256 withdrawFromStaking = miningInfo.stakingAmount;
        withdrawStaking(miningInfo, stakingPool[miningInfo.tokenStaking], withdrawFromStaking);
        withdrawUniStaking(miningInfo, miningInfo.uniStakingAmount);

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = withdrawUniswapParam(
            miningInfo.uniPositionID,
            miningInfo.uniLiquidity,
            deadline
        );

        if (miningInfo.tokenUni < miningInfo.tokenStaking) {
            (amountUni, amountStaking) = INonfungiblePositionManager(nftManager).decreaseLiquidity(params);
        } else {
            (amountStaking, amountUni) = INonfungiblePositionManager(nftManager).decreaseLiquidity(params);
        }
        miningInfo.uniLiquidity = 0;
        // we donot involve miningInfo.uniStakingAmount, because the amount has been involved in uniswap
        amountStaking += withdrawFromStaking;
        emit Withdraw(userMiningID, amountUni, amountStaking);
    }
}