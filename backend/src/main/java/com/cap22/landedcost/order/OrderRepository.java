package com.cap22.landedcost.order;

import java.util.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;

public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {
    @EntityGraph(attributePaths = { "customer", "destination", "items", "items.product" })
    Optional<OrderEntity> findWithDetailsByOrderId(UUID id);

    @EntityGraph(attributePaths = { "customer", "destination", "items", "items.product" })
    List<OrderEntity> findAllByOrderByCreatedAtDesc();
}
