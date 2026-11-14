package com.cap22.landedcost.carrier;

import java.time.Instant;
import java.util.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.shipment.*;

@RestController
@RequestMapping("/api/shipments/{shipmentId}/carrier-events")
public class CarrierEventController {

    private final CarrierEventRepository repo;
    private final ShipmentRepository shipments;

    public CarrierEventController(CarrierEventRepository r, ShipmentRepository s) {
        this.repo = r;
        this.shipments = s;
    }

    public record Req(
            String externalEventId,
            @NotBlank String rawEventCode,
            @NotBlank String normalizedEventType,
            @NotNull Instant occurredAt,
            Boolean isEffective,
            String rawPayload) {
    }

    public record Res(
            UUID carrierEventId,
            UUID shipmentId,
            String externalEventId,
            String rawEventCode,
            String normalizedEventType,
            Instant occurredAt,
            Instant receivedAt,
            boolean isDuplicate,
            boolean isEffective) {
    }

    @GetMapping
    public List<Res> list(@PathVariable UUID shipmentId) {
        return repo.findByShipmentShipmentIdOrderByOccurredAtDesc(shipmentId)
                .stream().map(this::toRes).toList();
    }

    @PostMapping
    @Transactional
    public Res create(
            @PathVariable UUID shipmentId,
            @Valid @RequestBody Req r) {

        Shipment s = shipments.findById(shipmentId)
                .orElseThrow(() -> ApiException.notFound("SHIPMENT_NOT_FOUND", "Shipment not found"));

        boolean dup = r.externalEventId() != null
                && repo.findByShipmentShipmentIdAndExternalEventId(shipmentId, r.externalEventId()).isPresent();

        CarrierEvent e = new CarrierEvent();

        e.setShipment(s);
        e.setExternalEventId(r.externalEventId());
        e.setRawEventCode(r.rawEventCode());
        e.setNormalizedEventType(r.normalizedEventType());
        e.setOccurredAt(r.occurredAt());
        e.setReceivedAt(Instant.now());
        e.setDuplicate(dup);
        e.setEffective(!dup && Boolean.TRUE.equals(r.isEffective()));
        e.setRawPayload(r.rawPayload());

        return toRes(repo.save(e));
    }

    private Res toRes(CarrierEvent e) {
        return new Res(
                e.getCarrierEventId(),
                e.getShipment().getShipmentId(),
                e.getExternalEventId(),
                e.getRawEventCode(),
                e.getNormalizedEventType(),
                e.getOccurredAt(),
                e.getReceivedAt(),
                e.isDuplicate(),
                e.isEffective());
    }
}
