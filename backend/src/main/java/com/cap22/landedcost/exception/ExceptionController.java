package com.cap22.landedcost.exception;

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
public class ExceptionController {
    private final ShipmentExceptionRepository repo;
    private final ShipmentRepository shipments;

    public ExceptionController(ShipmentExceptionRepository r, ShipmentRepository s) {
        this.repo = r;
        this.shipments = s;
    }

    public record Req(@NotBlank String exceptionType, @NotBlank String severity, String status,
            @NotBlank String summary) {
    }

    public record Res(UUID exceptionId, UUID shipmentId, String exceptionType, String severity, String status,
            String summary, Instant openedAt, Instant resolvedAt) {
    }

    @GetMapping("/exceptions")
    public List<Res> list() {
        return repo.findAllByOrderByOpenedAtDesc().stream().map(this::toRes).toList();
    }

    @GetMapping("/shipments/{shipmentId}/exceptions")
    public List<Res> listForShipment(@PathVariable UUID shipmentId) {
        return repo.findByShipmentShipmentIdOrderByOpenedAtDesc(shipmentId).stream().map(this::toRes).toList();
    }

    @PostMapping("/shipments/{shipmentId}/exceptions")
    public Res create(@PathVariable UUID shipmentId, @Valid @RequestBody Req r) {
        Shipment s = shipments.findById(shipmentId)
                .orElseThrow(() -> ApiException.notFound("SHIPMENT_NOT_FOUND", "Shipment not found"));

        ShipmentException e = new ShipmentException();

        e.setShipment(s);
        e.setExceptionType(r.exceptionType());
        e.setSeverity(r.severity());
        e.setStatus(r.status() != null ? r.status() : "OPEN");
        e.setSummary(r.summary());

        return toRes(repo.save(e));
    }

    @PatchMapping("/exceptions/{id}/resolve")
    @Transactional
    public Res resolve(@PathVariable UUID id) {

        ShipmentException e = repo.findById(id)
                .orElseThrow(
                        () -> ApiException
                                .notFound("EXCEPTION_NOT_FOUND", "Exception not found"));
        e.setStatus("RESOLVED");
        e.setResolvedAt(Instant.now());
        return toRes(repo.save(e));
    }

    private Res toRes(ShipmentException e) {

        return new Res(
                e.getExceptionId(),
                e.getShipment().getShipmentId(),
                e.getExceptionType(),
                e.getSeverity(),
                e.getStatus(),
                e.getSummary(),
                e.getOpenedAt(),
                e.getResolvedAt());
    }
}
