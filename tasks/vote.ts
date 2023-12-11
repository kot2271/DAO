import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";
import { BigNumber } from "ethers";

task("vote", "Vote on a DAO proposal")
  .addParam("dao", "The DAO contract address")
  .addParam("proposalId", "The proposal ID")
  .addParam("support", "boolean, true = vote to support, false = against")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );

      const proposalId: BigNumber = taskArgs.proposalId;
      const support: boolean = taskArgs.support;

      await dao.vote(proposalId, support);

      const filter = dao.filters.Voted();
      const events = await dao.queryFilter(filter);
      const txUser = events[0].args["user"];
      const txId = events[0].args["id"];
      const txSupport = events[0].args["support"];

      if (txSupport) {
        console.log(`User: ${txUser} voted in support of proposal ${txId}`);
      } else {
        console.log(`User: ${txUser} voted against proposal ${txId}`);
      }
    }
  );
