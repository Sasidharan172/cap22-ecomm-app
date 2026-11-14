package com.cap22.landedcost.carrier;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.shipment.Shipment;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "carrier_events")
public class CarrierEvent {
    @Id
    @GeneratedValue
    @Column(name = "carrier_event_id")
    private UUID carrierEventId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id")
    private Shipment shipment;

    @Column(name = "external_event_id", length = 80)
    private String externalEventId;

    @Column(name = "raw_event_code", nullable = false, length = 60)
    private String rawEventCode;

    @Column(name = "normalized_event_type", nullable = false, length = 40)
    private String normalizedEventType;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "is_duplicate", nullable = false)
    private boolean isDuplicate;

    @Column(name = "is_effective", nullable = false)
    private boolean isEffective;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_payload", columnDefinition = "jsonb")
    private String rawPayload;

    @PrePersist
    void pre() {
        if (receivedAt == null)
            receivedAt = Instant.now();
    }

    public UUID getCarrierEventId() {
        return carrierEventId;
    }

    public void setCarrierEventId(UUID v) {
        carrierEventId = v;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public void setShipment(Shipment v) {
        shipment = v;
    }

    public String getExternalEventId() {
        return externalEventId;
    }

    public void setExternalEventId(String v) {
        externalEventId = v;
    }

    public String getRawEventCode() {
        return rawEventCode;
    }

    public void setRawEventCode(String v) {
        rawEventCode = v;
    }

    public String getNormalizedEventType() {
        return normalizedEventType;
    }

    public void setNormalizedEventType(String v) {
        normalizedEventType = v;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant v) {
        occurredAt = v;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public void setReceivedAt(Instant v) {
        receivedAt = v;
    }

    public boolean isDuplicate() {
        return isDuplicate;
    }

    public void setDuplicate(boolean v) {
        isDuplicate = v;
    }

    public boolean isEffective() {
        return isEffective;
    }

    public void setEffective(boolean v) {
        isEffective = v;
    }

    public String getRawPayload() {
        return rawPayload;
    }

    public void setRawPayload(String v) {
        rawPayload = v;
    }
}
