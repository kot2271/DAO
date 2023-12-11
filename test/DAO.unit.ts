import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { DAO, DaoToken } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { encodeFunctionCall } from "web3-eth-abi";

describe("DAO Contract", () => {
  let dao: DAO;
  let daoToken: DaoToken;
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const depositAmount = BigNumber.from("1000");
  const description = "Test proposal";
  const callData = encodeFunctionCall(
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

  beforeEach(async () => {
    signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    const DaoToken = await ethers.getContractFactory("DaoToken");
    daoToken = await DaoToken.deploy("DaoToken", "DAT");
    await daoToken.deployed();

    const DAO = await ethers.getContractFactory("DAO");
    dao = await DAO.deploy(
      daoToken.address,
      BigNumber.from("50"), // minimal quorum
      BigNumber.from(3600) // debating period (1 hour)
    );
    await dao.deployed();
  });

  describe("addProposal", () => {
    it("should add a new proposal", async () => {
      const proposalCount: BigNumber = (await dao.proposalsCount()).add(1);
      const blockNumber: BigNumber = BigNumber.from(
        await ethers.provider.getBlockNumber()
      );
      const proposalId = blockNumber.add(proposalCount);

      await expect(dao.addProposal(user1.address, description, callData))
        .to.emit(dao, "ProposalAdded")
        .withArgs(proposalId, description, user1.address);

      const proposal = await dao.proposals(proposalId);
      expect(proposal.description).to.be.equal(description);
      expect(proposal.recipient).to.be.equal(user1.address);
      expect(proposal.callData).to.be.equal(callData);
      expect(proposal.status).to.be.equal(1); // ADDED
    });

    it("should revert if not called by admin", async () => {
      const adminRole = await dao.ADMIN_ROLE();
      await expect(
        dao
          .connect(user1)
          .addProposal(user2.address, "Another test proposal", callData)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
    });
  });

  describe("deposit", () => {
    let proposalId: BigNumber;

    beforeEach(async () => {
      const proposalCount: BigNumber = (await dao.proposalsCount()).add(1);
      const blockNumber: BigNumber = BigNumber.from(
        await ethers.provider.getBlockNumber()
      );
      proposalId = blockNumber.add(proposalCount);
    });

    it("should deposit tokens and increase frozen amount", async () => {
      await dao
        .connect(owner)
        .addProposal(user1.address, description, callData);

      await daoToken.transfer(user2.address, depositAmount);
      await daoToken.connect(user2).approve(dao.address, depositAmount);

      await expect(dao.connect(user2).deposit(depositAmount))
        .to.emit(dao, "DepositMade")
        .withArgs(user2.address, depositAmount);

      const frozenTokens = await dao.frozenTokens(user2.address);
      expect(frozenTokens).to.be.equal(depositAmount);
    });

    it("should revert with TokenTransferFailed if token transfer fails in deposit", async () => {
      await dao.addProposal(user1.address, description, callData);
      await daoToken.connect(owner).approve(dao.address, 0); // Insufficient allowance
      await expect(dao.deposit(depositAmount)).to.be.revertedWithCustomError(
        dao,
        "TokenTransferFailed"
      );
    });

    it("should revert with DepositAmountMustBePositive if amount is zero", async () => {
      await expect(dao.deposit(0)).to.be.revertedWithCustomError(
        dao,
        "DepositAmountMustBePositive"
      );
    });

    it("should be reverted with custom error 'ProposalNotAddedYet'", async () => {
      await daoToken.connect(owner).approve(dao.address, depositAmount);
      await expect(dao.deposit(depositAmount)).to.be.revertedWithCustomError(
        dao,
        "ProposalNotAddedYet"
      );
    });
  });

  describe("withdraw", () => {
    let proposalId: BigNumber;

    beforeEach(async () => {
      const proposalCount: BigNumber = (await dao.proposalsCount()).add(1);
      const blockNumber: BigNumber = BigNumber.from(
        await ethers.provider.getBlockNumber()
      );
      proposalId = blockNumber.add(proposalCount);
      await dao
        .connect(owner)
        .addProposal(user1.address, description, callData);

      await daoToken.transfer(user2.address, depositAmount);
      await daoToken.connect(user2).approve(dao.address, depositAmount);

      await dao.connect(user2).deposit(depositAmount);
    });

    it("should withdraw tokens and decrease frozen amount", async () => {
      await expect(dao.connect(user2).withdraw())
        .to.emit(dao, "WithdrawalMade")
        .withArgs(user2.address, depositAmount);

      const frozenTokens = await dao.frozenTokens(user2.address);
      expect(frozenTokens).to.be.equal(0);
    });

    it("should revert with NoTokensToWithdraw if frozen tokens are zero", async () => {
      await expect(dao.withdraw()).to.be.revertedWithCustomError(
        dao,
        "NoTokensToWithdraw"
      );
    });

    it("should revert with CannotWithdrawWhileLocked if user is still locked", async () => {
      await dao.connect(user2).vote(proposalId, true);
      await expect(dao.connect(user2).withdraw()).to.be.revertedWithCustomError(
        dao,
        "CannotWithdrawWhileLocked"
      );
    });
  });

  describe("vote", () => {
    let proposalId: BigNumber;

    beforeEach(async () => {
      const proposalCount: BigNumber = (await dao.proposalsCount()).add(1);
      const blockNumber: BigNumber = BigNumber.from(
        await ethers.provider.getBlockNumber()
      );
      proposalId = blockNumber.add(proposalCount);
      await dao.addProposal(user1.address, description, callData);

      await daoToken.transfer(user2.address, depositAmount);
      await daoToken.connect(user2).approve(dao.address, depositAmount);
    });

    it("should register a vote for a proposal", async () => {
      await dao.connect(user2).deposit(depositAmount);
      const support = true;

      await expect(dao.connect(user2).vote(proposalId, support))
        .to.emit(dao, "Voted")
        .withArgs(user2.address, proposalId, support);

      const userVote = await dao.userVotes(user2.address, proposalId);
      expect(userVote).to.be.true;
    });

    it("should revert if voting closed", async () => {
      await dao.connect(user2).deposit(depositAmount);
      const support = true;

      const proposal = await dao.proposals(proposalId);

      // Fast forward time beyond voting deadline
      await time.increaseTo(proposal.votingDeadline);

      await expect(
        dao.connect(user2).vote(proposalId, support)
      ).to.be.revertedWithCustomError(dao, "VotingClosed");
    });

    it("should revert if user has no voting rights", async () => {
      const support = true;
      await expect(
        dao.connect(user2).vote(proposalId, support)
      ).to.be.revertedWithCustomError(dao, "NoVotingRightsWithoutFrozenTokens");
    });

    it("should revert if user already voted", async () => {
      await dao.connect(user2).deposit(depositAmount);
      const support = true;

      await dao.connect(user2).vote(proposalId, support);

      await expect(
        dao.connect(user2).vote(proposalId, false)
      ).to.be.revertedWithCustomError(dao, "UserAlreadyVoted");
    });
  });

  describe("finishProposal", () => {
    let proposalId: BigNumber;

    beforeEach(async () => {
      const proposalCount: BigNumber = (await dao.proposalsCount()).add(1);
      const blockNumber: BigNumber = BigNumber.from(
        await ethers.provider.getBlockNumber()
      );
      proposalId = blockNumber.add(proposalCount);
      await dao.addProposal(user1.address, description, callData);

      await daoToken.transfer(user2.address, depositAmount);
      await daoToken.connect(user2).approve(dao.address, depositAmount);
      await dao.connect(user2).deposit(depositAmount);
    });
    it("should finalize a proposal and execute call if quorum and vote are met", async () => {
      await dao.connect(user2).vote(proposalId, true);
      const proposal = await dao.proposals(proposalId);
      await time.increaseTo(proposal.votingDeadline);

      await expect(dao.connect(user2).finishProposal(proposalId))
        .to.emit(dao, "ProposalFinished")
        .withArgs(proposalId);
    });

    it("should reject a proposal if quorum is not met", async () => {
      await dao.connect(user2).vote(proposalId, true);
      await expect(
        dao.finishProposal(proposalId)
      ).to.be.revertedWithCustomError(dao, "VotingNotFinished");
    });

    it("should reject a proposal if vote is not in favor", async () => {
      await dao.connect(user2).vote(proposalId, false);

      const proposal = await dao.proposals(proposalId);

      await time.increaseTo(proposal.votingDeadline);

      await expect(dao.finishProposal(proposalId))
        .to.emit(dao, "ProposalRejected")
        .withArgs(proposalId, proposal.votesFor, proposal.votesAgainst, 50);
    });
  });

  describe("setMinimalQuorum", () => {
    const newQuorum = 25;

    it("should change the minimal quorum", async () => {
      await expect(dao.setMinimalQuorum(newQuorum))
        .to.emit(dao, "QuorumChanged")
        .withArgs(newQuorum);

      const minimalQuorum = await dao.minimalQuorum();
      expect(minimalQuorum).to.be.equal(newQuorum);
    });

    it("should revert if called by non-admin", async () => {
      const adminRole = await dao.ADMIN_ROLE();
      await expect(
        dao.connect(user1).setMinimalQuorum(newQuorum)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("should revert if new quorum is zero", async () => {
      await expect(dao.setMinimalQuorum(0)).to.be.revertedWithCustomError(
        dao,
        "MinimalQuorumMustBePositive"
      );
    });
  });

  describe("setDebatingPeriod", () => {
    const newPeriod = 7200; // 2 hours

    it("should change the debating period", async () => {
      await expect(dao.setDebatingPeriod(newPeriod))
        .to.emit(dao, "DebatingPeriodChanged")
        .withArgs(newPeriod);

      const debatingPeriod = await dao.debatingPeriod();
      expect(debatingPeriod).to.be.equal(newPeriod);
    });

    it("should revert if called by non-admin", async () => {
      const adminRole = await dao.ADMIN_ROLE();
      await expect(
        dao.connect(user1).setDebatingPeriod(newPeriod)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("should revert if new period is zero", async () => {
      await expect(dao.setDebatingPeriod(0)).to.be.revertedWithCustomError(
        dao,
        "DebatingPeriodMustBePositive"
      );
    });
  });

  describe("DaoToken Contract", () => {
    describe("constructor", () => {
      it("should set the initial supply to 1 million tokens", async () => {
        const totalTokens = await daoToken.totalSupply();
        expect(totalTokens).to.be.equal(
          BigNumber.from("1000000").mul(BigNumber.from("10").pow(18))
        );
      });

      it("should assign all tokens to the deploying address", async () => {
        const deployerBalance = await daoToken.balanceOf(owner.address);
        expect(deployerBalance).to.be.equal(
          BigNumber.from("1000000").mul(BigNumber.from("10").pow(18))
        );
      });
    });

    describe("mint", () => {
      it("should mint new tokens to the specified address", async () => {
        await expect(daoToken.connect(owner).mint(user1.address, depositAmount))
          .to.emit(daoToken, "TokensMinted")
          .withArgs(user1.address, depositAmount);

        const recipientBalance = await daoToken.balanceOf(user1.address);
        expect(recipientBalance).to.be.equal(BigNumber.from(depositAmount));
      });

      it("should revert if called by a non-owner", async () => {
        await expect(
          daoToken.connect(user1).mint(user1.address, depositAmount)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("burn", () => {
      it("should burn tokens from the specified address", async () => {
        const balanceBefore = await daoToken.balanceOf(owner.address);

        await expect(daoToken.burn(owner.address, depositAmount))
          .to.emit(daoToken, "TokensBurned")
          .withArgs(owner.address, depositAmount);

        const balanceAfter = await daoToken.balanceOf(owner.address);
        expect(balanceAfter).to.be.equal(balanceBefore.sub(depositAmount));
      });

      it("should revert if called by a non-owner", async () => {
        await expect(
          daoToken.connect(user1).burn(owner.address, depositAmount)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });

    describe("burnFrom", () => {
      it("should burn tokens from the specified address that are approved by owner", async () => {
        await daoToken.transfer(user1.address, depositAmount);
        await daoToken.connect(user1).approve(owner.address, depositAmount);

        await expect(
          daoToken.connect(owner).burnFrom(user1.address, depositAmount)
        )
          .to.emit(daoToken, "TokensBurned")
          .withArgs(user1.address, depositAmount);

        const recipientBalance = await daoToken.balanceOf(user1.address);
        expect(recipientBalance).to.be.equal(BigNumber.from(0));
      });

      it("should revert if called by a non-owner", async () => {
        await daoToken.transfer(user1.address, depositAmount);
        await daoToken.connect(user1).approve(owner.address, depositAmount);
        await expect(
          daoToken.connect(user1).burnFrom(user1.address, depositAmount)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("should revert if burning amount exceeds allowance", async () => {
        await daoToken.connect(user1).approve(owner.address, depositAmount);

        await expect(
          daoToken.connect(owner).burnFrom(user1.address, depositAmount.add(1))
        ).to.be.revertedWith("ERC20: burn amount exceeds allowance");
      });
    });

    describe("_beforeTokenTransfer", () => {
      it("emits TokensMinted event on mint", async function () {
        await expect(daoToken.mint(user1.address, depositAmount))
          .to.emit(daoToken, "TokensMinted")
          .withArgs(user1.address, depositAmount);
      });

      it("emits TokensBurned event on burn", async function () {
        await expect(daoToken.burn(owner.address, depositAmount))
          .to.emit(daoToken, "TokensBurned")
          .withArgs(owner.address, depositAmount);
      });
    });
  });
});
