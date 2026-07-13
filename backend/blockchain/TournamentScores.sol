// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TournamentScores {

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // ---------- TOURNOIS ----------

    struct Tournament {
        uint256 id;
        string  name;
        string  creator;
        uint256 maxPlayers;
        uint256 createdAt;
        bool    exists;
    }

    mapping(uint256 => Tournament) public tournaments;

    event TournamentCreated(uint256 indexed id, string name, string creator);

    function createTournament(
        uint256 id,
        string calldata name,
        string calldata creator,
        uint256 maxPlayers
    ) external onlyOwner {
        require(!tournaments[id].exists, "Tournament already exists");
        tournaments[id] = Tournament(id, name, creator, maxPlayers, block.timestamp, true);
        emit TournamentCreated(id, name, creator);
    }

    // ---------- MATCHS ----------

    struct MatchResult {
        uint256 tournamentId;
        uint256 matchId;
        uint256 round;
        string  player1;
        string  player2;
        uint8   score1;
        uint8   score2;
        string  winner;
        uint256 playedAt;
    }

    mapping(uint256 => MatchResult[]) private matchesByTournament;

    event MatchRecorded(uint256 indexed tournamentId, uint256 matchId, string winner);

    function recordMatch(
        uint256 tournamentId,
        uint256 matchId,
        uint256 round,
        string calldata player1,
        string calldata player2,
        uint8   score1,
        uint8   score2,
        string calldata winner
    ) external onlyOwner {
        require(tournaments[tournamentId].exists, "Tournament does not exist");
        matchesByTournament[tournamentId].push(MatchResult(
            tournamentId, matchId, round, player1, player2, score1, score2, winner, block.timestamp
        ));
        emit MatchRecorded(tournamentId, matchId, winner);
    }

    function getMatchCount(uint256 tournamentId) external view returns (uint256) {
        return matchesByTournament[tournamentId].length;
    }

    function getMatch(uint256 tournamentId, uint256 index)
        external view returns (MatchResult memory)
    {
        return matchesByTournament[tournamentId][index];
    }
}
