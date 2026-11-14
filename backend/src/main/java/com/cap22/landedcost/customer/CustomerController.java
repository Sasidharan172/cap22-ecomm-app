package com.cap22.landedcost.customer;

import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {
    private final CustomerRepository repo;

    public CustomerController(CustomerRepository repo) {
        this.repo = repo;
    }

    public record Req(@NotBlank String customerNumber, @NotBlank String name, String email,
            @NotBlank @Size(min = 2, max = 2) String countryCode) {
    }

    @GetMapping
    public List<Customer> list() {
        return repo.findAll();
    }

    @GetMapping("/{id}")
    public Customer get(@PathVariable UUID id) {
        return repo.findById(id).orElseThrow(
                () -> ApiException.notFound("CUSTOMER_NOT_FOUND", "Customer not found"));
    }

    @PostMapping
    public Customer create(@Valid @RequestBody Req r) {
        Customer c = new Customer();
        apply(c, r);
        return repo.save(c);
    }

    @PutMapping("/{id}")
    public Customer update(@PathVariable UUID id, @Valid @RequestBody Req r) {
        Customer c = get(id);
        apply(c, r);
        return repo.save(c);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        if (!repo.existsById(id))
            throw ApiException.notFound("CUSTOMER_NOT_FOUND", "Customer not found");
        repo.deleteById(id);
    }

    private void apply(Customer c, Req r) {
        c.setCustomerNumber(r.customerNumber());
        c.setName(r.name());
        c.setEmail(r.email());
        c.setCountryCode(r.countryCode().toUpperCase());
    }
}
