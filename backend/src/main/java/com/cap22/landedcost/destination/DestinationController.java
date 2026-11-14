package com.cap22.landedcost.destination;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;

@RestController
@RequestMapping("/api/destinations")
public class DestinationController {

    private final DestinationRepository repo;

    public DestinationController(DestinationRepository repo) {
        this.repo = repo;
    }

    public record Req(
            @NotBlank @Size(min = 2, max = 2) String code,
            @NotBlank String name,
            @NotBlank @Size(min = 3, max = 3) String currency) {
    }

    @GetMapping
    public List<Destination> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public Destination get(@PathVariable UUID id) {
        return repo.findById(id).orElseThrow(
                () -> ApiException.notFound("DEST_NOT_FOUND", "Destination not found"));
    }

    @PostMapping
    public Destination create(@Valid @RequestBody Req r) {
        Destination d = new Destination();
        apply(d, r);
        return repo.save(d);
    }

    @PutMapping("/{id}")
    public Destination update(@PathVariable UUID id, @Valid @RequestBody Req r) {
        Destination d = get(id);
        apply(d, r);
        return repo.save(d);
    }

    private void apply(Destination d, Req r) {
        d.setCode(r.code().toUpperCase());
        d.setName(r.name());
        d.setCurrency(r.currency().toUpperCase());
    }
}
