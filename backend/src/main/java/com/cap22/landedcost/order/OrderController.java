package com.cap22.landedcost.order;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService svc;

    public OrderController(OrderService svc) {
        this.svc = svc;
    }

    @GetMapping
    public List<OrderDtos.Res> list() {
        return svc.list();
    }

    @GetMapping("/{id}")
    public OrderDtos.Res get(@PathVariable UUID id) {
        return svc.get(id);
    }

    @PostMapping
    public OrderDtos.Res create(
            @Valid @RequestBody OrderDtos.CreateReq r) {
        return svc.create(r);
    }
}
