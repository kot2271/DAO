// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DAO is AccessControl {
    /**
     * @notice This role has the privilege to add proposals
     * and change minimal quorum and debating period.
     */
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum VotingStatus {
        UNDEFINED,
        ADDED,
        FINISHED,
        REJECTED
    }

    /**
     * @notice This struct stores information about a proposal
     */
    struct Proposal {
        string description;
        bytes callData;
        address payable recipient;
        uint256 votingDeadline;
        uint256 votesFor;
        uint256 votesAgainst;
        VotingStatus status;
    }

    /**
     * @notice The ERC20 token used for voting.
     */
    IERC20 public daoToken;

    /**
     * @notice Maps proposal IDs to their corresponding Proposal structs.
     */
    mapping(uint256 => Proposal) public proposals;

    /**
     * @notice Number of created proposals.
     */
    uint256 public proposalsCount;

    /**
     * @notice Maps user addresses to their deposited token amount.
     */
    mapping(address => uint256) public frozenTokens;

    /**
     * @notice Maps user addresses to the timestamp until which their voting rights
     * are locked due to open proposals.
     */
    mapping(address => uint256) public lockedTill;

    /**
     * @notice Maps user addresses to a mapping of proposal IDs
     * to voting booleans (true for support, false for against).
     */
    mapping(address => mapping(uint256 => bool)) public userVotes;

    /**
     * @notice The minimum number of tokens required for a proposal
     * to be considered accepted.
     */
    uint256 public minimalQuorum;

    /**
     * @notice The duration of voting for proposals in seconds.
     */
    uint256 public debatingPeriod;

    // Events
    /**
     * @notice Emitted when a new proposal is added.
     */
    event ProposalAdded(
        uint256 indexed id,
        string description,
        address recipient
    );

    /**
     * @notice Emitted when a user deposits tokens to participate in voting.
     */
    event DepositMade(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user withdraws their deposited tokens.
     */
    event WithdrawalMade(address indexed user, uint256 amount);

    /**
     * @notice Emitted when a user votes on a proposal.
     */
    event Voted(address indexed user, uint256 id, bool support);

    /**
     * @notice Emitted when a voting period ends and a proposal is either accepted.
     */
    event ProposalFinished(uint256 indexed id);

    /**
     * @notice Emitted when the minimal quorum for proposal acceptance is changed.
     */
    event QuorumChanged(uint256 newQuorum);

    /**
     * @notice Emitted when the voting duration for proposals is changed.
     */
    event DebatingPeriodChanged(uint256 newPeriod);

    /**
     * @notice Emitted when a proposal is rejected after voting finishes.
     */
    event ProposalRejected(
        uint256 indexed id,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 minQuorum
    );

    // Custom errors
    /**
     * @notice Reverted when an address is invalid (e.g., address(0)).
     */
    error InvalidAddress();

    /**
     * @notice Reverted when the deposit amount is zero.
     */
    error DepositAmountMustBePositive();

    /**
     * @notice Reverted when trying to interact with proposals
     * before any are added.
     */
    error ProposalNotAddedYet();

    /**
     * @notice Reverted when a user attempts to withdraw tokens t
     * hey don't have deposited.
     */
    error NoTokensToWithdraw();

    /**
     * @notice Reverted when a user attempts to withdraw tokens
     * while their voting rights are locked.
     */
    error CannotWithdrawWhileLocked();

    /**
     * @notice Reverted when tokens transfer fails
     * due to insufficient balance or other issues.
     */
    error TokenTransferFailed();

    /**
     * @notice Reverted when trying to vote on a proposal
     * after the voting period has ended.
     */
    error VotingClosed();

    /**
     * @notice Reverted when trying to execute a proposal
     * that has already been executed.
     */
    error ProposalAlreadyExecuted();

    /**
     * @notice Reverted when a user attempts to vote
     * without having deposited tokens.
     */
    error NoVotingRightsWithoutFrozenTokens();

    /**
     * @notice Reverted when a user tries to vote
     * on a proposal twice.
     */
    error UserAlreadyVoted();

    /**
     * @notice Reverted when execution of a proposal's callData fails.
     */
    error ProposalExecutionFailed();

    /**
     * @notice Reverted when trying to finalize a proposal
     * before the voting period ends.
     */
    error VotingNotFinished();

    /**
     * @notice Reverted when setting the minimal quorum
     * to a non-positive value.
     */
    error MinimalQuorumMustBePositive();

    /**
     * @notice Reverted when setting the debating period
     * to a non-positive value.
     */
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

    /**
     * @notice Adds a new proposal with the specified details.
     * Only accessible to ADMIN_ROLE.
     */
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

    /**
     * @notice Allows users to deposit tokens to participate in voting.
     */
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

    /**
     * @notice Allows users to withdraw their deposited tokens.
     */
    function withdraw() external {
        if (msg.sender == address(0)) revert InvalidAddress();
        if (frozenTokens[msg.sender] <= 0) revert NoTokensToWithdraw();

        // Check if user is locked
        if (lockedTill[msg.sender] > block.timestamp)
            revert CannotWithdrawWhileLocked();

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

    /**
     * @notice Allows users to vote on a proposal.
     */
    function vote(uint256 id, bool support) external {
        if (block.timestamp >= proposals[id].votingDeadline)
            revert VotingClosed();
        if (frozenTokens[msg.sender] <= 0)
            revert NoVotingRightsWithoutFrozenTokens();
        if (userVotes[msg.sender][id]) revert UserAlreadyVoted();

        userVotes[msg.sender][id] = true;

        // Update lockedTill
        lockedTill[msg.sender] = Math.max(
            lockedTill[msg.sender],
            proposals[id].votingDeadline
        );

        if (support) {
            proposals[id].votesFor += frozenTokens[msg.sender];
        } else {
            proposals[id].votesAgainst += frozenTokens[msg.sender];
        }
        emit Voted(msg.sender, id, support);
    }

    /**
     * @notice Finalizes a proposal by checking quorum and executing its callData
     * if it's accepted.
     */
    function finishProposal(uint256 id) external {
        if (block.timestamp < proposals[id].votingDeadline)
            revert VotingNotFinished();

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

            // Update user's locked state
            lockedTill[msg.sender] = block.timestamp;

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

            // Update user's locked state
            lockedTill[msg.sender] = block.timestamp;
        }
    }

    /**
     * @notice Allows ADMIN_ROLE to change the minimum quorum
     * required for proposal acceptance.
     */
    function setMinimalQuorum(uint256 newQuorum) external onlyRole(ADMIN_ROLE) {
        if (newQuorum <= 0) revert MinimalQuorumMustBePositive();
        minimalQuorum = newQuorum;
        emit QuorumChanged(newQuorum);
    }

    /**
     * @notice Allows ADMIN_ROLE to change the voting duration for proposals.
     */
    function setDebatingPeriod(
        uint256 newPeriod
    ) external onlyRole(ADMIN_ROLE) {
        if (newPeriod <= 0) revert DebatingPeriodMustBePositive();
        debatingPeriod = newPeriod;
        emit DebatingPeriodChanged(newPeriod);
    }
}
