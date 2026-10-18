// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title ChogNobles: Chog Snow bastards and Chogling heirs (deployed once per kind).
/// @notice Minted gaslessly by the game's relayer. tokenURI is live metadata, so titles earned in play
///         show up in every wallet and marketplace. Choglings record both parents on-chain.
contract ChogNobles is ERC721 {
    address public relayer;
    address public owner;
    string public base;
    uint256 public totalSupply;
    mapping(uint256 => uint256[2]) public parentsOf; // noble keys (see ChogLedger)

    event Begot(uint256 indexed tokenId, uint256 parentA, uint256 parentB);

    constructor(string memory name_, string memory symbol_, string memory base_, address _relayer) ERC721(name_, symbol_) {
        owner = msg.sender; relayer = _relayer; base = base_;
    }

    function mint(address to, uint256 id, uint256 parentA, uint256 parentB) external {
        require(msg.sender == relayer, "not the raven");
        _mint(to, id);
        totalSupply++;
        if (parentA != 0) { parentsOf[id] = [parentA, parentB]; emit Begot(id, parentA, parentB); }
    }

    function setBase(string calldata b) external { require(msg.sender == owner, "not owner"); base = b; }
    function _baseURI() internal view override returns (string memory) { return base; }
}
