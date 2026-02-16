// SPDX-License-Identifier: MIT
pragma solidity ^0.8.33;

import "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/**
 * @title TunnelForwarder
 * @dev Production-grade forwarder for Tunnel Private Chat.
 * Supports EIP-712 structured signing and deadlines.
 */
contract TunnelForwarder is ERC2771Forwarder {
    constructor(string memory name) ERC2771Forwarder(name) {}
}