package com.cap22.landedcost.document;

import java.util.*;
import java.util.UUID;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentDocumentRepository extends JpaRepository<ShipmentDocument, UUID> {

    @EntityGraph(attributePaths = { "shipment", "documentType" })
    List<ShipmentDocument> findByShipmentShipmentId(UUID shipmentId);
}
