// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DAO is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum VotingStatus {
        UNDEFINED,
        ADDED,
        FINISHED,
        REJECTED
    }

    // Proposal struct with details
    struct Proposal {
        string description;
        bytes callData;
        address payable recipient;
        uint256 votingDeadline;
        uint256 votesFor;
        uint256 votesAgainst;
        VotingStatus status;
    }

    // DAO token
    IERC20 public daoToken;

    // Mapping to store proposals
    mapping(uint256 => Proposal) public proposals;

    // Number of created proposals
    uint256 public proposalsCount;

    // User's frozen tokens mapping
    mapping(address => uint256) public frozenTokens;

    // Mapping user votes by voting
    mapping(address => mapping(uint256 => bool)) public userVotes;

    // Minimum quorum for proposal acceptance
    uint256 public minimalQuorum;

    // Voting duration in seconds
    uint256 public debatingPeriod;

    // Mapping of active votes of users
    mapping(address => uint256) public activeProposals;

    event ProposalAdded(
        uint256 indexed id,
        string description,
        address recipient
    );
    event DepositMade(address indexed user, uint256 amount);
    event WithdrawalMade(address indexed user, uint256 amount);
    event Voted(address indexed user, uint256 id, bool support);
    event ProposalFinished(uint256 indexed id);
    event QuorumChanged(uint256 newQuorum);
    event DebatingPeriodChanged(uint256 newPeriod);
    event ProposalRejected(
        uint256 indexed id,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 minQuorum
    );

    error InvalidAddress();
    error DepositAmountMustBePositive();
    error ProposalNotAddedYet();
    error NoTokensToWithdraw();
    error CannotWithdrawWhileVoting();
    error TokenTransferFailed();
    error VotingClosed();
    error ProposalAlreadyExecuted();
    error NoVotingRightsWithoutFrozenTokens();
    error UserAlreadyVoted();
    error ProposalExecutionFailed();
    error VotingNotFinished();
    error MinimalQuorumMustBePositive();
    error DebatingPeriodMustBePositive();

    constructor(
        address _daoToken,
        uint256 _minimalQuorum,
        uint256 _debatingPeriod
    ) {
        _grantRole(ADMIN_ROLE, msg.sender);
        daoToken = IERC20(_daoToken);
        minimalQuorum = _minimalQuorum;
        debatingPeriod = _debatingPeriod;
    }

    // Function to add a proposal
    function addProposal(
        address payable recipient,
        string memory description,
        bytes memory callData
    ) external onlyRole(ADMIN_ROLE) {
        uint256 id = block.number + proposalsCount;
        Proposal storage proposal = proposals[id];
        proposal.recipient = recipient;
        proposal.description = description;
        proposal.callData = callData;
        proposal.votingDeadline = block.timestamp + debatingPeriod;
        proposal.status = VotingStatus.ADDED;

        emit ProposalAdded(id, description, recipient);

        proposalsCount++;
    }

    // Function to deposit tokens
    function deposit(uint256 amount) external {
        if (msg.sender == address(0)) revert InvalidAddress();
        if (amount <= 0) revert DepositAmountMustBePositive();
        if (proposalsCount == 0) revert ProposalNotAddedYet();

        // Prepare data for calling the token contract transferFrom function
        bytes memory data = abi.encodeWithSignature(
            "transferFrom(address,address,uint256)",
            msg.sender,
            address(this),
            amount
        );

        // Call function transferFrom daoToken contract
        (bool success, ) = address(daoToken).call(data);
        if (!success) revert TokenTransferFailed();
        frozenTokens[msg.sender] += amount;

        emit DepositMade(msg.sender, amount);
    }

    // Function to withdraw tokens
    function withdraw() external {
        if (msg.sender == address(0)) revert InvalidAddress();
        if (frozenTokens[msg.sender] <= 0) revert NoTokensToWithdraw();
        if (activeProposals[msg.sender] != 0)
            revert CannotWithdrawWhileVoting();

        uint256 amount = frozenTokens[msg.sender];

        // Prepare data for calling the daoToken contract transfer function
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            msg.sender,
            amount
        );

        // Call function transfer daoToken contract
        (bool success, ) = address(daoToken).call(data);
        if (!success) revert TokenTransferFailed();

        delete frozenTokens[msg.sender];
        emit WithdrawalMade(msg.sender, amount);
    }

    // Function to vote on a proposal
    function vote(uint256 id, bool support) external {
        if (block.timestamp >= proposals[id].votingDeadline)
            revert VotingClosed();
        if (
            proposals[id].status == VotingStatus.FINISHED ||
            proposals[id].status == VotingStatus.REJECTED
        ) revert ProposalAlreadyExecuted();
        if (frozenTokens[msg.sender] <= 0)
            revert NoVotingRightsWithoutFrozenTokens();
        if (userVotes[msg.sender][id]) revert UserAlreadyVoted();

        userVotes[msg.sender][id] = true;
        activeProposals[msg.sender]++;

        if (support) {
            proposals[id].votesFor += frozenTokens[msg.sender];
        } else {
            proposals[id].votesAgainst += frozenTokens[msg.sender];
        }
        emit Voted(msg.sender, id, support);
    }

    // Function to finalize a proposal
    function finishProposal(uint256 id) external {
        if (block.timestamp < proposals[id].votingDeadline)
            revert VotingNotFinished();
        if (
            proposals[id].status == VotingStatus.FINISHED ||
            proposals[id].status == VotingStatus.REJECTED
        ) revert ProposalAlreadyExecuted();

        bool quorumReached = proposals[id].votesFor +
            proposals[id].votesAgainst >=
            minimalQuorum;
        bool proposalAccepted = proposals[id].votesFor >
            proposals[id].votesAgainst;

        if (quorumReached && proposalAccepted) {
            (bool success, ) = proposals[id].recipient.call(
                proposals[id].callData
            );
            if (!success) revert ProposalExecutionFailed();
            proposals[id].status = VotingStatus.FINISHED;
            userVotes[msg.sender][id] = false;
            activeProposals[msg.sender]--;

            emit ProposalFinished(id);
        } else {
            proposals[id].status = VotingStatus.REJECTED;
            emit ProposalRejected(
                id,
                proposals[id].votesFor,
                proposals[id].votesAgainst,
                minimalQuorum
            );
            userVotes[msg.sender][id] = false;
            activeProposals[msg.sender]--;
        }
    }

    // Function to change minimal quorum
    function setMinimalQuorum(uint256 newQuorum) external onlyRole(ADMIN_ROLE) {
        if (newQuorum <= 0) revert MinimalQuorumMustBePositive();
        minimalQuorum = newQuorum;
        emit QuorumChanged(newQuorum);
    }

    // Function to change voting duration
    function setDebatingPeriod(
        uint256 newPeriod
    ) external onlyRole(ADMIN_ROLE) {
        if (newPeriod <= 0) revert DebatingPeriodMustBePositive();
        debatingPeriod = newPeriod;
        emit DebatingPeriodChanged(newPeriod);
    }
}
