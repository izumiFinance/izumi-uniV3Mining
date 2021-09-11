const managerAddress = "0xC8DA14B7A7145683aE947618ceb3A0005A1E9d65";
const USDT = "0x2cc9e757dA9C89d297E78972E60837A2Cf4e8447";
const USDC = "0xd3B76498DdB2773809A01de45dD42AfDF15B3d5C";
const rewardPerBlock = "10000000000000000000"; //10
const rewardUpperTick = 50000;
const rewardLowerTick = 0;
const startBlock = 0;
const endBlock = 100000;
const rewardTokenAddress = "0x06d86063db09F46502354784ADb2af466A92Ec98";

async function main() {
  // We get the contract to deploy
  const Mining = await ethers.getContractFactory("Mining");
  const mining = await Mining.deploy(managerAddress, USDT, USDC, 500, rewardTokenAddress, rewardPerBlock, rewardUpperTick, rewardLowerTick, startBlock, endBlock);

  await mining.deployed();
  console.log(mining.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
