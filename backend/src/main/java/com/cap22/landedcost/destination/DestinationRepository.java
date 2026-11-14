package com.cap22.landedcost.destination;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DestinationRepository extends JpaRepository<Destination, UUID> {
}
