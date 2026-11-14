package com.cap22.landedcost.order;

import java.time.Instant;
import java.util.*;
import jakarta.persistence.*;
import com.cap22.landedcost.customer.Customer;
import com.cap22.landedcost.destination.Destination;

@Entity
@Table(name = "orders")
public class OrderEntity {

    @Id
    @GeneratedValue
    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "order_number", nullable = false, unique = true, length = 40)
    private String orderNumber;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_id")
    private Destination destination;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<OrderItem> items = new ArrayList<>();

    @PrePersist
    void pre() {
        if (createdAt == null)
            createdAt = Instant.now();
        if (status == null)
            status = "CREATED";
    }

    public UUID getOrderId() {
        return orderId;
    }

    public void setOrderId(UUID v) {
        orderId = v;
    }

    public String getOrderNumber() {
        return orderNumber;
    }

    public void setOrderNumber(String v) {
        orderNumber = v;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer v) {
        customer = v;
    }

    public Destination getDestination() {
        return destination;
    }

    public void setDestination(Destination v) {
        destination = v;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String v) {
        currency = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant v) {
        createdAt = v;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> v) {
        items = v;
    }
}
