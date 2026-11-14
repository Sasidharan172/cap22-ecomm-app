package com.cap22.landedcost.exception;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.shipment.Shipment;

@Entity
@Table(name = "exceptions")
public class ShipmentException {

    @Id
    @GeneratedValue
    @Column(name = "exception_id")
    private UUID exceptionId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id")
    private Shipment shipment;

    @Column(name = "exception_type", nullable = false, length = 40)
    private String exceptionType;

    @Column(nullable = false, length = 10)
    private String severity;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false, length = 240)
    private String summary;

    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @PrePersist
    void pre() {
        if (openedAt == null)
            openedAt = Instant.now();
        if (status == null)
            status = "OPEN";
    }

    public UUID getExceptionId() {
        return exceptionId;
    }

    public void setExceptionId(UUID v) {
        exceptionId = v;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public void setShipment(Shipment v) {
        shipment = v;
    }

    public String getExceptionType() {
        return exceptionType;
    }

    public void setExceptionType(String v) {
        exceptionType = v;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String v) {
        severity = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String v) {
        summary = v;
    }

    public Instant getOpenedAt() {
        return openedAt;
    }

    public void setOpenedAt(Instant v) {
        openedAt = v;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant v) {
        resolvedAt = v;
    }
}
