package com.cap22.landedcost.document;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "document_types")
public class DocumentType {
    @Id
    @GeneratedValue
    @Column(name = "document_type_id")
    private UUID documentTypeId;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    public UUID getDocumentTypeId() {
        return documentTypeId;
    }

    public void setDocumentTypeId(UUID v) {
        documentTypeId = v;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String v) {
        code = v;
    }

    public String getName() {
        return name;
    }

    public void setName(String v) {
        name = v;
    }
}
