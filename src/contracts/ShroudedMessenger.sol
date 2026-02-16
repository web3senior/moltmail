// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

// ■■■ External Dependencies ■■■
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ShroudedMessenger
 * @dev Secure messaging using Stealth Addresses as Meeting Points to break on-chain metadata links.
 * Compatible with ERC-2771 for gasless transactions via relayers.
 */
contract ShroudedMessenger is ERC2771Context, Ownable {
    // ■■■ State Variables ■■■

    address private _activeForwarder;
    uint256 private nextMessageId;

    struct Session {
        address burnerKey; // The temporary session key (delegate)
        uint256 expiresAt; // Timestamp when the session authorization ends
    }

    struct ChatMessage {
        address sender; // The permanent wallet address of the sender (Alice)
        uint256 timestamp; // Block timestamp of the message
        bytes32 cidHash; // Optional: IPFS hash digest for integrity checks
        string fullCID; // The IPFS pointer to the encrypted message body
        bytes encryptedKey; // The AES key wrapped with the recipient's Public Key
        bool isEdited;
        bool isDeleted;
    }

    // Maps a Conversation Topic (H(SharedSecret)) to its message history
    mapping(bytes32 => uint256[]) public conversationThreads;

    // Maps a main wallet to its active burner session
    mapping(address => Session) public userSessions;

    // Registry for users to publish their encryption Public Keys (ECIES/secp256k1)
    mapping(address => bytes) public publicKeyRegistry;

    // A central archive of every message sent through the contract
    mapping(uint256 => ChatMessage) public messageArchive;

    // Privacy-focused storage: Maps a Meeting Point (Stealth Address) to its active topics
    // An observer cannot link these Meeting Points to specific users
    mapping(address => bytes32[]) private _meetingPointInbox;
    mapping(address => mapping(bytes32 => bool)) private _isTopicInInbox;

    // ■■■ Events ■■■

    event MessageSent(uint256 indexed messageId, bytes32 indexed topic, address indexed sender, uint256 timestamp);
    event MessageUpdated(uint256 indexed messageId, bytes32 newCidHash);
    event MessageDeleted(uint256 indexed messageId);
    event PublicKeyRegistered(address indexed user);
    event SessionAuthorized(address indexed owner, address indexed burner, uint256 expiry);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);

    // ■■■ Constructor ■■■

    constructor(address initialForwarder) ERC2771Context(initialForwarder) Ownable(msg.sender) {
        _activeForwarder = initialForwarder;
    }

    // ■■■ Access Control ■■■

    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        return forwarder == _activeForwarder;
    }

    function updateForwarder(address newForwarder) external onlyOwner {
        require(newForwarder != address(0), "Invalid address");
        address oldForwarder = _activeForwarder;
        _activeForwarder = newForwarder;
        emit ForwarderUpdated(oldForwarder, newForwarder);
    }

    /**
     * @dev Overrides to support gasless transactions via ERC-2771.
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    // ■■■ Logic Control ■■■

    /**
     * @dev Resolves the true identity of the sender, whether they use a direct wallet or a Burner session.
     */
    function _resolveActor(address _owner) internal view returns (address actor) {
        if (_owner == address(0)) {
            return _msgSender();
        } else {
            Session memory session = userSessions[_owner];
            require(session.burnerKey == _msgSender(), "Not authorized burner");
            require(block.timestamp < session.expiresAt, "Session expired");
            return _owner;
        }
    }

    /**
     * @dev Internal helper to index a conversation topic at a specific stealth meeting point.
     */
    function _recordTopicAtMeetingPoint(address _meetingPoint, bytes32 _topic) internal {
        if (!_isTopicInInbox[_meetingPoint][_topic]) {
            _isTopicInInbox[_meetingPoint][_topic] = true;
            _meetingPointInbox[_meetingPoint].push(_topic);
        }
    }

    // ■■■ Session Management ■■■

    /**
     * @dev Alice authorizes a temporary Burner key to sign messages on her behalf to avoid wallet popups.
     */
    function authorizeSession(
        address _burner,
        uint256 _durationFromNow
    ) external {
        require(_burner != address(0), "Invalid burner");
        require(_durationFromNow > 0, "Duration must be > 0");

        uint256 expiresAt = block.timestamp + _durationFromNow;
        userSessions[_msgSender()] = Session({burnerKey: _burner, expiresAt: expiresAt});
        emit SessionAuthorized(_msgSender(), _burner, expiresAt);
    }

    // ■■■ User Operations ■■■

    /**
     * @dev Registers the user's public key so others can derive shared secrets and stealth addresses.
     */
    function registerPublicKey(address _owner, bytes calldata _publicKey) external {
        address actor = _resolveActor(_owner);
        require(_publicKey.length == 65 || _publicKey.length == 64, "Invalid key length");
        publicKeyRegistry[actor] = _publicKey;
        emit PublicKeyRegistered(actor);
    }

    // ■■■ Messaging Logic ■■■

    /**
     * @dev The core delivery function.
     * @param _owner The sender's main wallet.
     * @param _meetingPoint The Stealth Address (Phase 1 or 2) calculated from the Shared Secret.
     * @param _topic The unique conversation ID (H(SharedSecret)).
     * @param _cidHash Verification hash for the IPFS content.
     * @param _fullCID Pointer to the encrypted payload.
     * @param _encKey The AES key encrypted for the recipient.
     */
    function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external {
        address actor = _resolveActor(_owner);

        // 1. File the conversation under the secret meeting point
        _recordTopicAtMeetingPoint(_meetingPoint, _topic);

        // 2. Create the message record
        uint256 messageId = nextMessageId++;
        ChatMessage storage newMessage = messageArchive[messageId];

        newMessage.sender = actor;
        newMessage.timestamp = block.timestamp;
        newMessage.cidHash = _cidHash;
        newMessage.fullCID = _fullCID;
        newMessage.encryptedKey = _encKey;

        // 3. Link the message to the specific thread
        conversationThreads[_topic].push(messageId);

        emit MessageSent(messageId, _topic, actor, block.timestamp);
    }

    // ■■■ Data Retrieval ■■■

    /**
     * @dev Bob's scanner calls this for every stealth address in his local contact list.
     */
    function getPaginatedTopics(address _meetingPoint, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory result, uint256 total) {
        total = _meetingPointInbox[_meetingPoint].length;
        if (_offset >= total) return (new bytes32[](0), total);

        uint256 size = _limit;
        if (_offset + _limit > total) size = total - _offset;

        result = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            // Returns most recent topics first
            result[i] = _meetingPointInbox[_meetingPoint][total - 1 - (_offset + i)];
        }
        return (result, total);
    }

    /**
     * @dev Fetches history for a specific conversation.
     */
    function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (ChatMessage[] memory result, uint256 totalMessages) {
        uint256[] storage fullHistory = conversationThreads[_topic];
        totalMessages = fullHistory.length;

        if (totalMessages == 0 || _offset >= totalMessages) return (new ChatMessage[](0), totalMessages);

        uint256 start = totalMessages - _offset;
        uint256 count = _limit;
        if (count > start) count = start;

        result = new ChatMessage[](count);
        for (uint256 i = 0; i < count; i++) {
            // Returns most recent messages first
            result[i] = messageArchive[fullHistory[start - 1 - i]];
        }
        return (result, totalMessages);
    }
}
