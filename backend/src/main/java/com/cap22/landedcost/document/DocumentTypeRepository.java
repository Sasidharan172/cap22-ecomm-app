package com.cap22.landedcost.document;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentTypeRepository extends JpaRepository<DocumentType, UUID> {
}
