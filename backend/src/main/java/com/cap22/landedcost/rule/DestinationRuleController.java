package com.cap22.landedcost.rule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.destination.*;

@RestController
@RequestMapping("/api/destination-rules")
public class DestinationRuleController {
    private final DestinationRuleRepository repo;
    private final DestinationRepository destinations;

    public DestinationRuleController(DestinationRuleRepository repo, DestinationRepository destinations) {
        this.repo = repo;
        this.destinations = destinations;
    }

    public record Req(
            @NotNull UUID destinationId,
            String hsPrefix,
            @NotNull BigDecimal dutyRate,
            @NotNull BigDecimal taxRate,
            @NotNull BigDecimal handlingFee,
            @NotBlank String feeCurrency,
            @NotNull LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean active) {
    }

    public record Res(
            UUID ruleId,
            UUID destinationId,
            String destinationCode,
            String hsPrefix,
            BigDecimal dutyRate,
            BigDecimal taxRate,
            BigDecimal handlingFee,
            String feeCurrency,
            LocalDate effectiveFrom,
            LocalDate effectiveTo,
            Boolean active) {
    }

    @GetMapping
    public List<Res> list(
            @RequestParam(required = false) UUID destinationId) {

        List<DestinationRule> rs = destinationId != null
                ? repo.findByDestinationDestinationId(destinationId)
                : repo.findAll();

        return rs.stream().map(this::toRes).toList();
    }

    @PostMapping
    public Res create(@Valid @RequestBody Req r) {

        Destination d = destinations.findById(r.destinationId())
                .orElseThrow(
                        () -> ApiException
                                .notFound("DEST_NOT_FOUND", "Destination not found"));

        DestinationRule x = new DestinationRule();
        apply(x, d, r);

        return toRes(repo.save(x));
    }

    private void apply(DestinationRule x, Destination d, Req r) {

        x.setDestination(d);
        x.setHsPrefix(r.hsPrefix() == null
                ? ""
                : r.hsPrefix());
        x.setDutyRate(r.dutyRate());
        x.setTaxRate(r.taxRate());
        x.setHandlingFee(r.handlingFee());
        x.setFeeCurrency(r.feeCurrency().toUpperCase());
        x.setEffectiveFrom(r.effectiveFrom());
        x.setEffectiveTo(r.effectiveTo());
        x.setActive(r.active() == null ? true : r.active());
    }

    private Res toRes(DestinationRule r) {

        return new Res(
                r.getRuleId(),
                r.getDestination().getDestinationId(),
                r.getDestination().getCode(),
                r.getHsPrefix(),
                r.getDutyRate(),
                r.getTaxRate(),
                r.getHandlingFee(),
                r.getFeeCurrency(),
                r.getEffectiveFrom(),
                r.getEffectiveTo(),
                r.getActive());
    }
}
