import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";
import { BigNumber } from "ethers";

task("finishProposal", "Finish DAO proposal voting")
  .addParam("dao", "The DAO contract address")
  .addParam("proposalId", "The proposal ID")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );
      const proposalId: BigNumber = taskArgs.proposalId;

      await dao.finishProposal(proposalId);

      const proposal = await dao.proposals(proposalId);

      if (proposal.status == 2) {
        const filter = dao.filters.ProposalFinished();
        const events = await dao.queryFilter(filter);
        const txId = events[0].args["id"];
        
        console.log(`✅ Proposal ${txId} succeeded!`);
      } else {
        const filter = dao.filters.ProposalRejected();
        const events = await dao.queryFilter(filter);
        const id = events[0].args["id"];
        const votesFor = events[0].args["votesFor"];
        const votesAgainst = events[0].args["votesAgainst"];
        const minQuorum = events[0].args["minQuorum"];

        console.log(`❌ Proposal ${id} failed.`);
        console.log(
          `votesFor: ${votesFor}
        votesAgainst: ${votesAgainst}
        minQuorum: ${minQuorum}`
        );
      }
    }
  );
