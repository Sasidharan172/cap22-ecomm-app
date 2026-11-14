package com.cap22.landedcost.shipment;

import java.util.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {
    @EntityGraph(attributePaths = {
            "order",
            "order.customer",
            "order.destination",
            "items",
            "items.orderItem",
            "items.orderItem.product"
    })
    Optional<Shipment> findWithDetailsByShipmentId(UUID id);

    @EntityGraph(attributePaths = { "order", "order.destination" })
    List<Shipment> findAllByOrderByShipmentIdDesc();
}
