// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChogLedger: the Game of Chogs save file, keyed by NFT.
/// @notice A noble's key is (kind << 248 | tokenId): kind 1 = Chog Genesis, 2 = Chog Snow (bastard), 3 = Chogling (heir).
///         State follows the token, never the wallet: whoever owns the NFT inherits its titles, clout, spouse and scars.
contract ChogLedger {
    struct Record {
        uint64 clout;
        uint64 titles;     // bitmask, see TITLE_* in shared/game.js order
        uint32 day;        // last day sealed
        uint16 house;
        uint16 scars;
        uint16 shames;
        uint16 stabWins;
        uint256 spouse;    // noble key, 0 = unwed
        uint256 liege;     // noble key, 0 = sworn to nobody
    }
    struct Update { uint256 key; Record r; }

    address public relayer;
    address public owner;
    mapping(uint8 => address) public collectionOf;  // kind => ERC-721
    mapping(uint256 => Record) public records;
    mapping(uint32 => bytes32) public ravenOf;       // day => keccak of that day's Raven
    uint32 public lastDay;
    uint256 public king;

    event Sealed(uint32 indexed day, bytes32 raven, uint256 king, uint256 nobles);
    event Crowned(uint32 indexed day, uint256 indexed king);

    modifier onlyRelayer() { require(msg.sender == relayer, "not the raven"); _; }

    constructor(address _relayer, address genesis) {
        owner = msg.sender;
        relayer = _relayer;
        collectionOf[1] = genesis;
    }

    function setCollection(uint8 kind, address c) external { require(msg.sender == owner, "not owner"); collectionOf[kind] = c; }
    function setRelayer(address r) external { require(msg.sender == owner, "not owner"); relayer = r; }

    /// @notice Close a day: write every noble that changed, the Raven's hash and the Iron Toilet's occupant.
    function seal(uint32 day, bytes32 raven, uint256 _king, Update[] calldata ups) external onlyRelayer {
        for (uint256 i = 0; i < ups.length; i++) records[ups[i].key] = ups[i].r;
        if (day > lastDay) lastDay = day;
        ravenOf[day] = raven;
        if (_king != king) { king = _king; emit Crowned(day, _king); }
        emit Sealed(day, raven, _king, ups.length);
    }

    function keyOf(uint8 kind, uint256 tokenId) public pure returns (uint256) { return (uint256(kind) << 248) | tokenId; }
    function recordOf(uint8 kind, uint256 tokenId) external view returns (Record memory) { return records[keyOf(kind, tokenId)]; }
}
