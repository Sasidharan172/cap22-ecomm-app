package com.cap22.landedcost.customer;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "customers")
public class Customer {

    @Id
    @GeneratedValue
    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "customer_number", nullable = false, unique = true, length = 40)
    private String customerNumber;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 160)
    private String email;

    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode;

    public UUID getCustomerId() {
        return customerId;
    }

    public void setCustomerId(UUID id) {
        this.customerId = id;
    }

    public String getCustomerNumber() {
        return customerNumber;
    }

    public void setCustomerNumber(String v) {
        this.customerNumber = v;
    }

    public String getName() {
        return name;
    }

    public void setName(String v) {
        this.name = v;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String v) {
        this.email = v;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public void setCountryCode(String v) {
        this.countryCode = v;
    }
}
