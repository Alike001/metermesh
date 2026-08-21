// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MeterMeshProofAnchor} from "../src/MeterMeshProofAnchor.sol";

contract MeterMeshProofAnchorTest {
    MeterMeshProofAnchor internal anchor;
    bytes32 internal constant EVIDENCE_HASH = keccak256("meter-evidence");
    bytes32 internal constant SOURCE_TRANSACTION_HASH = keccak256("x-layer-transaction");

    function setUp() public {
        anchor = new MeterMeshProofAnchor();
    }

    function testAnchorsAndReadsBack() public {
        bytes32 returnedHash = anchor.anchorEvidence(EVIDENCE_HASH, SOURCE_TRANSACTION_HASH);
        require(returnedHash == EVIDENCE_HASH, "anchor hash mismatch");
        require(anchor.isAnchored(EVIDENCE_HASH), "anchor should be readable");

        MeterMeshProofAnchor.Anchor memory stored = anchor.getAnchor(EVIDENCE_HASH);
        require(stored.sourceTransactionHash == SOURCE_TRANSACTION_HASH, "source hash mismatch");
        require(stored.anchoredBy == address(this), "writer mismatch");
        require(stored.anchoredAt != 0, "timestamp missing");
        require(stored.chainId == block.chainid, "chain id mismatch");
    }

    function testRejectsZeroEvidenceHash() public {
        try anchor.anchorEvidence(bytes32(0), SOURCE_TRANSACTION_HASH) {
            revert("zero evidence hash accepted");
        } catch (bytes memory reason) {
            require(reason.length > 0, "missing invalid evidence error");
        }
    }

    function testRejectsZeroSourceTransactionHash() public {
        try anchor.anchorEvidence(EVIDENCE_HASH, bytes32(0)) {
            revert("zero source hash accepted");
        } catch (bytes memory reason) {
            require(reason.length > 0, "missing invalid source error");
        }
    }

    function testRejectsDuplicateEvidence() public {
        anchor.anchorEvidence(EVIDENCE_HASH, SOURCE_TRANSACTION_HASH);
        try anchor.anchorEvidence(EVIDENCE_HASH, SOURCE_TRANSACTION_HASH) {
            revert("duplicate evidence accepted");
        } catch (bytes memory reason) {
            require(reason.length > 0, "missing duplicate error");
        }
    }
}
