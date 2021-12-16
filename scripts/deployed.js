const contracts = {
	// coinbase
	coinbase: "0xD4D6F030520649c7375c492D37ceb56571f768D0",

	// uniswapV3
	nftManger: "0x5202254db4B1Eb6632D54B6860ebC85892889fD1",
	nftMangerJson: "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json",
	factory: "0x8c05B8e31C5f94EDF49173f2b04E637a81F6510f",
	factoryJson: "@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json",
	poolJson: "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json",

	swapRouter: "0x6d44131a2A84B49Fa1F73e7c854A0c90982ffdB5",
	swapRouterJson: "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json",

	// tokens and contracts
    izumiTest: {
		USDT6: "0x4e9c1b4BB1A38e4Aa1be3aa53Ab757ec1961e25e",
		USDT: "0x44B61a549B16ba204c4c6dA053EC2BB0Cf97bb24",
		USDC: "0xe507AAC9eFb2A08F53C7BC73B3B1b8BCf883E41B",
		DAI: "0xA97f8bc2b98a56f648340e05406cc7E34bB25D3A",
		BIT: "0x41BC21bdcF0FA87ae6eeFcBE0e4dB29dB2b650C1",
		iZi: "0xEe5e3852434eB67F8e9E97015e32845861ea15E8",
		LIDO: "0xB7556AF20fDcCfA1f3E10AFDaFfef1F975Fd26fF",
		SPELL: "0x280F127021DeeB3Bd147a15e213A1B595dD21bfe",
		MIM: "0x52F87F2F02B0FD6797905644572F76537260CC8b",
		stETH: "0x0453189A122462bd64348F01EBdcD20d2d60be81",
	    WETH9: "0x3AD23A16A81Cd40010F39309876978F20DD2f682",
		
		AIRDROP: "0x6A794Ac1AD9401cb988f00F4ad2629F09B28d172",
		ONESIDE_USDC_BIT_3000: "0x4177ae2fBB01cD2704ed36864678B43DFf1D365B",
		// ONESIDE_USDC_IZI_3000: "0x41FAe2a2e93B1d775aef0975F4FBDe48C13b81A9",
		// ONESIDE_USDT_BIT_3000: "0x1B4B2b2AaF55bDd83F9611c6d9E51bb6b7C13EF3",
		ONESIDE_WETH9_IZI_3000: "0xD9b9679FCbc6CcbeA0b96077591c685a7ae6cbA2",

		testOracle: '0xf88Ac555B741d1301C1d04F3b053871fB4A0bBf9',
    },

	arbitrum: {
		USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
		USDC: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
		factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
		nftManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
	},

}

module.exports = contracts;

