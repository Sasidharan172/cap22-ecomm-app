package com.cap22.landedcost.shipment;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {
    private final ShipmentService svc;

    public ShipmentController(ShipmentService svc) {
        this.svc = svc;
    }

    public record StatusReq(String status) {
    }

    @GetMapping
    public List<ShipmentDtos.Res> list() {
        return svc.list();
    }

    @GetMapping("/{id}")
    public ShipmentDtos.Res get(@PathVariable UUID id) {
        return svc.get(id);
    }

    @PostMapping
    public ShipmentDtos.Res create(@Valid @RequestBody ShipmentDtos.CreateReq r) {
        return svc.create(r);
    }

    @PatchMapping("/{id}/status")
    public ShipmentDtos.Res status(@PathVariable UUID id, @RequestBody StatusReq r) {
        return svc.updateStatus(id, r.status());
    }
}
