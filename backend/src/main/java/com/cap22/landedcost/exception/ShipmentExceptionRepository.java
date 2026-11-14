package com.cap22.landedcost.exception;

import java.util.*;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentExceptionRepository extends JpaRepository<ShipmentException, UUID> {

    @EntityGraph(attributePaths = "shipment")
    List<ShipmentException> findByShipmentShipmentIdOrderByOpenedAtDesc(UUID shipmentId);

    @EntityGraph(attributePaths = "shipment")
    List<ShipmentException> findAllByOrderByOpenedAtDesc();
}
