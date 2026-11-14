package com.cap22.landedcost.document;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.shipment.Shipment;

@Entity
@Table(name = "shipment_documents")
public class ShipmentDocument {
    @Id
    @GeneratedValue
    @Column(name = "shipment_document_id")
    private UUID shipmentDocumentId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id")
    private Shipment shipment;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "document_type_id")
    private DocumentType documentType;

    @Column(name = "verification_status", nullable = false, length = 20)
    private String verificationStatus = "PENDING";

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @PrePersist
    void pre() {
        if (receivedAt == null)
            receivedAt = Instant.now();
    }

    public UUID getShipmentDocumentId() {
        return shipmentDocumentId;
    }

    public void setShipmentDocumentId(UUID v) {
        shipmentDocumentId = v;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public void setShipment(Shipment v) {
        shipment = v;
    }

    public DocumentType getDocumentType() {
        return documentType;
    }

    public void setDocumentType(DocumentType v) {
        documentType = v;
    }

    public String getVerificationStatus() {
        return verificationStatus;
    }

    public void setVerificationStatus(String v) {
        verificationStatus = v;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public void setReceivedAt(Instant v) {
        receivedAt = v;
    }
}
