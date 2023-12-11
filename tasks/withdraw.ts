import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";

task("withdraw", "Withdraw tokens from the DAO")
  .addParam("dao", "The DAO contract address")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );

      const signers = await hre.ethers.getSigners();
      const signer = signers[0];

      const balanceBefore = await dao.frozenTokens(signer.address);
      const ethBalanceBefore = hre.ethers.utils.formatEther(balanceBefore);

      await dao.withdraw();

      const balanceAfter = await dao.frozenTokens(signer.address);
      const ethBalanceAfter = hre.ethers.utils.formatEther(balanceAfter);

      const filter = dao.filters.WithdrawalMade();
      const events = await dao.queryFilter(filter);
      const user = events[0].args["user"];
      const amount = events[0].args["amount"];

      const etherAmount = hre.ethers.utils.formatEther(amount);

      console.log(
        `User: ${user} has withdrawn their ${etherAmount} tokens from the DAO`
      );
      console.log(`Balance before: ${ethBalanceBefore} DaoToken's`);
      console.log(`New balance: ${ethBalanceAfter} DaoToken's`);
    }
  );
