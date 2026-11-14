package com.cap22.landedcost.shipment;

import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.order.OrderItem;

@Entity
@Table(name = "shipment_items")
public class ShipmentItem {

    @Id
    @GeneratedValue
    @Column(name = "shipment_item_id")
    private UUID shipmentItemId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id")
    private Shipment shipment;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id")
    private OrderItem orderItem;

    @Column(name = "quantity_shipped", nullable = false)
    private Integer quantityShipped;

    public UUID getShipmentItemId() {
        return shipmentItemId;
    }

    public void setShipmentItemId(UUID v) {
        shipmentItemId = v;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public void setShipment(Shipment v) {
        shipment = v;
    }

    public OrderItem getOrderItem() {
        return orderItem;
    }

    public void setOrderItem(OrderItem v) {
        orderItem = v;
    }

    public Integer getQuantityShipped() {
        return quantityShipped;
    }

    public void setQuantityShipped(Integer v) {
        quantityShipped = v;
    }
}
