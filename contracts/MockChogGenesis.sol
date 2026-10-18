// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MockChogGenesis: testnet stand-in with the same token ids as Chog Genesis (1..1969), for demos and testing.
contract MockChogGenesis is ERC721 {
    address public owner;
    constructor() ERC721("Chog Genesis (testnet mock)", "mCHOG") { owner = msg.sender; }
    function mint(address to, uint256[] calldata ids) external {
        require(msg.sender == owner, "not owner");
        for (uint256 i = 0; i < ids.length; i++) _mint(to, ids[i]);
    }
    /// @notice Anyone may claim one unminted id on testnet, so judges can try the holder flow.
    function faucet(uint256 id) external {
        require(id >= 1 && id <= 1969 && balanceOf(msg.sender) < 3, "greedy");
        _mint(msg.sender, id);
    }
}
