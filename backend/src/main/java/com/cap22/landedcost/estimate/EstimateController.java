package com.cap22.landedcost.estimate;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class EstimateController {
    private final EstimateService svc;

    public EstimateController(EstimateService svc) {
        this.svc = svc;
    }

    @PostMapping("/estimates")
    public EstimateDtos.Res create(@Valid @RequestBody EstimateDtos.CreateReq r) {
        return svc.create(r);
    }

    @GetMapping("/estimates/{id}")
    public EstimateDtos.Res get(@PathVariable UUID id) {
        return svc.get(id);
    }

    @GetMapping("/shipments/{shipmentId}/estimates")
    public List<EstimateDtos.Res> list(@PathVariable UUID shipmentId) {
        return svc.listForShipment(shipmentId);
    }
}
