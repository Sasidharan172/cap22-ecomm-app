package com.cap22.landedcost.estimate;

import java.util.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

public interface LandedCostEstimateRepository extends JpaRepository<LandedCostEstimate, UUID> {

    @EntityGraph(attributePaths = {
            "shipment",
            "shipment.order",
            "shipment.order.destination",
            "rule",
            "exchangeRate",
            "components",
            "previousEstimate" })
    Optional<LandedCostEstimate> findWithDetailsByEstimateId(UUID id);

    @EntityGraph(attributePaths = {
            "shipment",
            "components",
            "rule",
            "exchangeRate",
            "previousEstimate" })
    List<LandedCostEstimate> findByShipmentShipmentIdOrderByEstimateVersionDesc(UUID shipmentId);

    Optional<LandedCostEstimate> findFirstByShipmentShipmentIdAndRequestKey(UUID shipmentId, String requestKey);

    @Query("select coalesce(max(e.estimateVersion),0) from LandedCostEstimate e where e.shipment.shipmentId=:sid")
    Integer maxVersion(UUID sid);
}
