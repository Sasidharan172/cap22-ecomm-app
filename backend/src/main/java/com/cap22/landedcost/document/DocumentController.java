package com.cap22.landedcost.document;

import java.time.Instant;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.shipment.*;

@RestController
@RequestMapping("/api")
public class DocumentController {
    private final DocumentTypeRepository types;
    private final ShipmentDocumentRepository docs;
    private final ShipmentRepository shipments;

    public DocumentController(
            DocumentTypeRepository t,
            ShipmentDocumentRepository d,
            ShipmentRepository s) {

        this.types = t;
        this.docs = d;
        this.shipments = s;
    }

    public record TypeReq(
            @NotBlank String code,
            @NotBlank String name) {
    }

    public record DocReq(
            @NotNull UUID documentTypeId,
            String verificationStatus) {
    }

    public record DocRes(
            UUID shipmentDocumentId,
            UUID shipmentId,
            UUID documentTypeId,
            String documentTypeCode,
            String documentTypeName,
            String verificationStatus,
            Instant receivedAt) {
    }

    @GetMapping("/document-types")
    public List<DocumentType> listTypes() {
        return types.findAll();
    }

    @PostMapping("/document-types")
    public DocumentType createType(@Valid @RequestBody TypeReq r) {
        DocumentType t = new DocumentType();
        t.setCode(r.code());
        t.setName(r.name());
        return types.save(t);
    }

    @GetMapping("/shipments/{shipmentId}/documents")
    public List<DocRes> listDocs(@PathVariable UUID shipmentId) {
        return docs.findByShipmentShipmentId(shipmentId)
                .stream()
                .map(this::toRes).toList();
    }

    @PostMapping("/shipments/{shipmentId}/documents")
    @Transactional
    public DocRes addDoc(@PathVariable UUID shipmentId, @Valid @RequestBody DocReq r) {
        Shipment s = shipments.findById(shipmentId)
                .orElseThrow(
                        () -> ApiException.notFound("SHIPMENT_NOT_FOUND", "Shipment not found"));
        DocumentType t = types.findById(r.documentTypeId())
                .orElseThrow(
                        () -> ApiException.notFound("DOC_TYPE_NOT_FOUND", "Document type not found"));
        ShipmentDocument d = new ShipmentDocument();
        d.setShipment(s);
        d.setDocumentType(t);
        d.setVerificationStatus(r.verificationStatus() != null ? r.verificationStatus() : "PENDING");
        return toRes(docs.save(d));
    }

    private DocRes toRes(ShipmentDocument d) {

        return new DocRes(
                d.getShipmentDocumentId(),
                d.getShipment().getShipmentId(),
                d.getDocumentType().getDocumentTypeId(),
                d.getDocumentType().getCode(),
                d.getDocumentType().getName(),
                d.getVerificationStatus(),
                d.getReceivedAt());
    }
}
