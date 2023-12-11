import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO, DaoToken } from "../typechain";

task("deposit", "Deposit tokes to the DAO")
  .addParam("dao", "The DAO contract address")
  .addParam("token", "The DaoToken contract address")
  .addParam("amount", "Amount of tokens to deposit")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );
      const daoToken: DaoToken = <DaoToken>(
        await hre.ethers.getContractAt("DaoToken", taskArgs.token as string)
      );

      const amount = hre.ethers.utils.parseEther(taskArgs.amount);

      await daoToken.approve(dao.address, amount);

      await hre.ethers.provider.send("evm_increaseTime", [20]);

      //   console.log("Pausing execution...");

      //     await new Promise(resolve => setTimeout(resolve, 20 * 1000));

      //     console.log("Done!")

      await dao.deposit(amount);

      const filter = dao.filters.DepositMade();
      const events = await dao.queryFilter(filter);
      const txUser = events[0].args["user"];
      const txAmount = events[0].args["amount"];

      const etherAmount = hre.ethers.utils.formatEther(txAmount);

      console.log(
        `User: ${txUser} has deposited ${etherAmount} DaoToken's into the DAO at address ${dao.address}`
      );
    }
  );
