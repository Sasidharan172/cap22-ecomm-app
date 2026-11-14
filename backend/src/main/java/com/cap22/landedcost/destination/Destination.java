package com.cap22.landedcost.destination;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "destinations")
public class Destination {

    @Id
    @GeneratedValue
    @Column(name = "destination_id")
    private UUID destinationId;

    @Column(nullable = false, unique = true, length = 2)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 3)
    private String currency;

    public UUID getDestinationId() {
        return destinationId;
    }

    public void setDestinationId(UUID id) {
        this.destinationId = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String v) {
        this.code = v;
    }

    public String getName() {
        return name;
    }

    public void setName(String v) {
        this.name = v;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String v) {
        this.currency = v;
    }
}
