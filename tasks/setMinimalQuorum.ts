import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";
import { BigNumber } from "ethers";

task("setMinimalQuorum", "Set minimal quorum for DAO")
  .addParam("dao", "The DAO contract address")
  .addParam("quorum", "New minimal quorum number")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );

      const newQuorum: BigNumber = taskArgs.quorum;

      await dao.setMinimalQuorum(newQuorum);

      const filter = dao.filters.QuorumChanged();
      const events = await dao.queryFilter(filter);
      const txNewQuorum = events[0].args["newQuorum"];

      console.log(`Minimal quorum changed to ${txNewQuorum} `);
    }
  );
