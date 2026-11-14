package com.cap22.landedcost.carrier;

import java.util.*;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarrierEventRepository extends JpaRepository<CarrierEvent, UUID> {

    @EntityGraph(attributePaths = "shipment")
    List<CarrierEvent> findByShipmentShipmentIdOrderByOccurredAtDesc(UUID shipmentId);

    Optional<CarrierEvent> findByShipmentShipmentIdAndExternalEventId(UUID shipmentId, String externalEventId);
}
