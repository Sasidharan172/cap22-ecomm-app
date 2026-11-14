package com.cap22.landedcost.exchange;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

@RestController
@RequestMapping("/api/exchange-rates")
public class ExchangeRateController {
    private final ExchangeRateRepository repo;

    public ExchangeRateController(ExchangeRateRepository repo) {
        this.repo = repo;
    }

    public record Req(
            @NotBlank String baseCurrency,
            @NotBlank String targetCurrency,
            @NotNull BigDecimal exchangeRate,
            @NotNull LocalDate effectiveDate,
            @NotBlank String source) {
    }

    @GetMapping
    public List<ExchangeRate> list() {
        return repo.findAllByOrderByEffectiveDateDesc();
    }

    @PostMapping
    public ExchangeRate create(@Valid @RequestBody Req r) {

        ExchangeRate e = new ExchangeRate();

        e.setBaseCurrency(r.baseCurrency().toUpperCase());
        e.setTargetCurrency(r.targetCurrency().toUpperCase());
        e.setExchangeRate(r.exchangeRate());
        e.setEffectiveDate(r.effectiveDate());
        e.setSource(r.source());

        return repo.save(e);
    }
}
