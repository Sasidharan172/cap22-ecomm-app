package com.cap22.landedcost.exchange;

import java.time.LocalDate;
import java.util.*;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, UUID> {

    @Query("""
                select e
                from ExchangeRate e
                where e.baseCurrency=:b
                    and e.targetCurrency=:t
                    and e.effectiveDate <= :d
                order by e.effectiveDate desc
            """)
    List<ExchangeRate> findApplicable(
            @Param("b") String base,
            @Param("t") String target,
            @Param("d") LocalDate d);

    List<ExchangeRate> findAllByOrderByEffectiveDateDesc();
}
