// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DaoToken
 * @dev Extends ERC20 and Ownable contracts to create a custom token with minting and burning functionalities.
 */
contract DaoToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * (10 ** decimals()));
    }

    /**
     * @dev Creates new tokens and assigns them to the specified address.
     * Only accessible by the owner of the contract.
     * @param to The address to which new tokens will be minted.
     * @param amount The amount of tokens to be minted.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Destroys tokens from the specified address.
     * Only accessible by the owner of the contract.
     * @param from The address from which tokens will be burned.
     * @param amount The amount of tokens to be burned.
     */
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }

    /**
     * @dev Destroys tokens from one account that are already approved by the owner.
     * Only accessible by the owner of the contract.
     * @param from The address from which tokens will be burned.
     * @param amount The amount of tokens to be burned.
     */
    function burnFrom(address from, uint256 amount) public onlyOwner {
        uint256 currentAllowance = allowance(from, _msgSender());
        require(
            currentAllowance >= amount,
            "ERC20: burn amount exceeds allowance"
        );
        unchecked {
            _approve(from, _msgSender(), currentAllowance - amount);
        }
        _burn(from, amount);
    }

    /**
     * @dev Event emitted when new tokens are minted.
     * @param to The address to which new tokens are minted.
     * @param amount The amount of tokens minted.
     */
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @dev Event emitted when tokens are burned.
     * @param from The address from which tokens are burned.
     * @param amount The amount of tokens burned.
     */
    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @dev Hook function called before any token transfer.
     * It includes logic to emit events when tokens are minted or burned.
     * Overrides the internal ERC20 function to customize token transfer behavior.
     * @param from Address transferring tokens.
     * @param to Address receiving tokens.
     * @param amount Amount of tokens being transferred.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);

        if (from == address(0)) {
            emit TokensMinted(to, amount);
        }

        if (to == address(0)) {
            emit TokensBurned(from, amount);
        }
    }
}