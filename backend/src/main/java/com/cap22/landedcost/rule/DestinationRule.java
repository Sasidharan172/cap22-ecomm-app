package com.cap22.landedcost.rule;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.*;
import com.cap22.landedcost.destination.Destination;

@Entity
@Table(name = "destination_rules")
public class DestinationRule {

    @Id
    @GeneratedValue
    @Column(name = "rule_id")
    private UUID ruleId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_id")
    private Destination destination;

    @Column(name = "hs_prefix", nullable = false, length = 10)
    private String hsPrefix;

    @Column(name = "duty_rate", nullable = false, precision = 9, scale = 6)
    private BigDecimal dutyRate;

    @Column(name = "tax_rate", nullable = false, precision = 9, scale = 6)
    private BigDecimal taxRate;

    @Column(name = "handling_fee", nullable = false, precision = 19, scale = 4)
    private BigDecimal handlingFee;

    @Column(name = "fee_currency", nullable = false, length = 3)
    private String feeCurrency;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(nullable = false)
    private Boolean active = true;

    public UUID getRuleId() {
        return ruleId;
    }

    public void setRuleId(UUID v) {
        ruleId = v;
    }

    public Destination getDestination() {
        return destination;
    }

    public void setDestination(Destination v) {
        destination = v;
    }

    public String getHsPrefix() {
        return hsPrefix;
    }

    public void setHsPrefix(String v) {
        hsPrefix = v;
    }

    public BigDecimal getDutyRate() {
        return dutyRate;
    }

    public void setDutyRate(BigDecimal v) {
        dutyRate = v;
    }

    public BigDecimal getTaxRate() {
        return taxRate;
    }

    public void setTaxRate(BigDecimal v) {
        taxRate = v;
    }

    public BigDecimal getHandlingFee() {
        return handlingFee;
    }

    public void setHandlingFee(BigDecimal v) {
        handlingFee = v;
    }

    public String getFeeCurrency() {
        return feeCurrency;
    }

    public void setFeeCurrency(String v) {
        feeCurrency = v;
    }

    public LocalDate getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(LocalDate v) {
        effectiveFrom = v;
    }

    public LocalDate getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(LocalDate v) {
        effectiveTo = v;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean v) {
        active = v;
    }
}
