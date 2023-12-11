import { getNamedAccounts, deployments } from "hardhat";
import { BigNumber } from "ethers";
import { verify } from "../helpers/verify";

const TOKEN_NAME = "DaoToken";
const TOKEN_SYMBOL = "DAT";
const DAO_CONTRACT_NAME = "DAO";

async function deployFunction() {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const tokenArgs = [TOKEN_NAME, TOKEN_SYMBOL];
  const token = await deploy(TOKEN_NAME, {
    from: deployer,
    log: true,
    args: tokenArgs,
    waitConfirmations: 6,
  });
  console.log(`${TOKEN_NAME} deployed at: ${token.address}`);
  await verify(token.address, tokenArgs);

  const minimalQuorum: BigNumber = BigNumber.from(5);
  const debatingPeriod: BigNumber = BigNumber.from(604800); // 7 days

  const args = [token.address, minimalQuorum, debatingPeriod];
  const daoContract = await deploy(DAO_CONTRACT_NAME, {
    from: deployer,
    log: true,
    args: args,
    waitConfirmations: 6,
  });
  console.log(`${DAO_CONTRACT_NAME} deployed at: ${daoContract.address}`);
  await verify(daoContract.address, args);
}

deployFunction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
