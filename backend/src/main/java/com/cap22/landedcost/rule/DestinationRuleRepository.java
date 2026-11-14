package com.cap22.landedcost.rule;

import java.time.LocalDate;
import java.util.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface DestinationRuleRepository extends JpaRepository<DestinationRule, UUID> {
    @EntityGraph(attributePaths = "destination")
    @Query("""
                select r
                from DestinationRule r
                where r.destination.destinationId=:destId
                    and r.active=true
                    and r.effectiveFrom <= :d
                    and (r.effectiveTo is null
                        or r.effectiveTo >= :d)
            """)
    List<DestinationRule> findActiveForDestinationOnDate(
            @Param("destId") UUID destId,
            @Param("d") LocalDate d);

    @EntityGraph(attributePaths = "destination")
    List<DestinationRule> findByDestinationDestinationId(UUID destId);

    @Override
    @EntityGraph(attributePaths = "destination")
    List<DestinationRule> findAll();
}
