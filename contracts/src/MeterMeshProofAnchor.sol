// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A minimal, append-only commitment point for MeterMesh evidence.
/// @dev This contract stores no funds, AI text, profiles, vouchers, or payment state.
contract MeterMeshProofAnchor {
    error InvalidEvidenceHash();
    error InvalidSourceTransactionHash();
    error EvidenceAlreadyAnchored(bytes32 evidenceHash);

    struct Anchor {
        bytes32 sourceTransactionHash;
        address anchoredBy;
        uint64 anchoredAt;
        uint64 chainId;
    }

    mapping(bytes32 => Anchor) private _anchors;

    event EvidenceAnchored(
        bytes32 indexed evidenceHash,
        bytes32 indexed sourceTransactionHash,
        address indexed anchoredBy,
        uint256 chainId,
        uint256 anchoredAt
    );

    /// @notice Commit a stable MeterMesh evidence hash and the X Layer transaction it explains.
    /// @param evidenceHash Keccak hash of the canonical signed request, delivery, and result.
    /// @param sourceTransactionHash The X Layer transaction hash referenced by that result.
    function anchorEvidence(bytes32 evidenceHash, bytes32 sourceTransactionHash)
        external
        returns (bytes32)
    {
        if (evidenceHash == bytes32(0)) revert InvalidEvidenceHash();
        if (sourceTransactionHash == bytes32(0)) revert InvalidSourceTransactionHash();
        if (_anchors[evidenceHash].anchoredAt != 0) {
            revert EvidenceAlreadyAnchored(evidenceHash);
        }

        uint64 timestamp = uint64(block.timestamp);
        uint64 chainId = uint64(block.chainid);
        _anchors[evidenceHash] = Anchor({
            sourceTransactionHash: sourceTransactionHash,
            anchoredBy: msg.sender,
            anchoredAt: timestamp,
            chainId: chainId
        });

        emit EvidenceAnchored(
            evidenceHash,
            sourceTransactionHash,
            msg.sender,
            chainId,
            timestamp
        );
        return evidenceHash;
    }

    function getAnchor(bytes32 evidenceHash) external view returns (Anchor memory) {
        return _anchors[evidenceHash];
    }

    function isAnchored(bytes32 evidenceHash) external view returns (bool) {
        return _anchors[evidenceHash].anchoredAt != 0;
    }
}
