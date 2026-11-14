package com.cap22.landedcost.shipment;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import com.cap22.landedcost.order.OrderEntity;

@Entity
@Table(name = "shipments")
public class Shipment {

    @Id
    @GeneratedValue
    @Column(name = "shipment_id")
    private UUID shipmentId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private OrderEntity order;

    @Column(name = "tracking_number", nullable = false, length = 80)
    private String trackingNumber;

    @Column(nullable = false, length = 60)
    private String carrier;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "expected_delivery_at")
    private Instant expectedDeliveryAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @OneToMany(mappedBy = "shipment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ShipmentItem> items = new ArrayList<>();

    public UUID getShipmentId() {
        return shipmentId;
    }

    public void setShipmentId(UUID v) {
        shipmentId = v;
    }

    public OrderEntity getOrder() {
        return order;
    }

    public void setOrder(OrderEntity v) {
        order = v;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String v) {
        trackingNumber = v;
    }

    public String getCarrier() {
        return carrier;
    }

    public void setCarrier(String v) {
        carrier = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getExpectedDeliveryAt() {
        return expectedDeliveryAt;
    }

    public void setExpectedDeliveryAt(Instant v) {
        expectedDeliveryAt = v;
    }

    public Instant getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(Instant v) {
        deliveredAt = v;
    }

    public List<ShipmentItem> getItems() {
        return items;
    }

    public void setItems(List<ShipmentItem> v) {
        items = v;
    }
}
