package com.cap22.landedcost.product;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue
    @Column(name = "product_id")
    private UUID productId;

    @Column(nullable = false, unique = true, length = 40)
    private String sku;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "hs_code", nullable = false, length = 10)
    private String hsCode;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 4)
    private BigDecimal unitPrice;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "country_of_origin", nullable = false, length = 2)
    private String countryOfOrigin;

    public UUID getProductId() {
        return productId;
    }

    public void setProductId(UUID id) {
        this.productId = id;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String v) {
        this.sku = v;
    }

    public String getName() {
        return name;
    }

    public void setName(String v) {
        this.name = v;
    }

    public String getHsCode() {
        return hsCode;
    }

    public void setHsCode(String v) {
        this.hsCode = v;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal v) {
        this.unitPrice = v;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String v) {
        this.currency = v;
    }

    public String getCountryOfOrigin() {
        return countryOfOrigin;
    }

    public void setCountryOfOrigin(String v) {
        this.countryOfOrigin = v;
    }
}
