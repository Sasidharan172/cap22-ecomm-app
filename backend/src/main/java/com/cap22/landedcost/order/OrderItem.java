package com.cap22.landedcost.order;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.product.Product;

@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue
    @Column(name = "order_item_id")
    private UUID orderItemId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private OrderEntity order;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal unitPrice;

    @Column(nullable = false, length = 3)
    private String currency;

    public UUID getOrderItemId() {
        return orderItemId;
    }

    public void setOrderItemId(UUID v) {
        orderItemId = v;
    }

    public OrderEntity getOrder() {
        return order;
    }

    public void setOrder(OrderEntity v) {
        order = v;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product v) {
        product = v;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer v) {
        quantity = v;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal v) {
        unitPrice = v;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String v) {
        currency = v;
    }
}
