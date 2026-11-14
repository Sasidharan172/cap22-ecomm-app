package com.cap22.landedcost.product;

import java.math.BigDecimal;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductRepository repo;

    public ProductController(ProductRepository repo) {
        this.repo = repo;
    }

    public record Req(
            @NotBlank String sku,
            @NotBlank String name,
            @NotBlank String hsCode,
            @NotNull BigDecimal unitPrice,
            @NotBlank @Size(min = 3, max = 3) String currency,
            @NotBlank @Size(min = 2, max = 2) String countryOfOrigin) {
    }

    @GetMapping
    public List<Product> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public Product get(@PathVariable UUID id) {

        return repo.findById(id)
                .orElseThrow(
                        () -> ApiException
                                .notFound(
                                        "PRODUCT_NOT_FOUND",
                                        "Product not found"));
    }

    @PostMapping
    public Product create(@Valid @RequestBody Req r) {

        Product p = new Product();
        apply(p, r);
        return repo.save(p);
    }

    @PutMapping("/{id}")
    public Product update(
            @PathVariable UUID id,
            @Valid @RequestBody Req r) {

        Product p = get(id);
        apply(p, r);
        return repo.save(p);
    }

    private void apply(Product p, Req r) {

        p.setSku(r.sku());
        p.setName(r.name());
        p.setHsCode(r.hsCode());
        p.setUnitPrice(r.unitPrice());
        p.setCurrency(r.currency().toUpperCase());
        p.setCountryOfOrigin(r.countryOfOrigin().toUpperCase());
    }
}
