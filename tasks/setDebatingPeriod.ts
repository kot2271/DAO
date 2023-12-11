import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";
import { BigNumber } from "ethers";

task("setDebatingPeriod", "Set debating period for DAO proposals")
  .addParam("dao", "The DAO contract address")
  .addParam("period", "New debating period in seconds")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );

      const newPeriod: BigNumber = taskArgs.period;

      await dao.setDebatingPeriod(newPeriod);

      const filter = dao.filters.DebatingPeriodChanged();
      const events = await dao.queryFilter(filter);
      const txNewPeriod = events[0].args["newPeriod"];

      console.log(`New debating period: ${txNewPeriod} seconds`);
    }
  );
