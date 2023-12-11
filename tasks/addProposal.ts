import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAO } from "../typechain";
import { encodeFunctionCall } from "web3-eth-abi";

task("addProposal", "Adds a new proposal to the DAO")
  .addParam("dao", "The DAO contract address")
  .addParam("description", "The proposal description")
  .addParam("recipient", "The proposal recipient address")
  .setAction(
    async (
      taskArgs: TaskArguments,
      hre: HardhatRuntimeEnvironment
    ): Promise<void> => {
      const dao: DAO = <DAO>(
        await hre.ethers.getContractAt("DAO", taskArgs.dao as string)
      );
      const calldata = encodeFunctionCall(
        {
          name: "myMethod",
          type: "function",
          inputs: [
            {
              type: "uint256",
              name: "myNumber",
            },
            {
              type: "string",
              name: "myString",
            },
          ],
        },
        ["2345675643", "Hello!%"]
      );
      const description = taskArgs.description as string;
      const recipient = taskArgs.recipient as string;
      await dao.addProposal(recipient, description, calldata);

      const filter = dao.filters.ProposalAdded();
      const events = await dao.queryFilter(filter);
      const txId = events[0].args["id"];
      const txDescription = events[0].args["description"];
      const txRecipient = events[0].args["recipient"];

      console.log(
        `Proposal added with id: ${txId}
        description: ${txDescription}
        recipient: ${txRecipient}`
      );
    }
  );
