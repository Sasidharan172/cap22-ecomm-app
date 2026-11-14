package com.cap22.landedcost.estimate;

import java.math.BigDecimal;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "cost_estimate_components")
public class CostEstimateComponent {
    @Id
    @GeneratedValue
    @Column(name = "component_id")
    private UUID componentId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "estimate_id")
    private LandedCostEstimate estimate;

    @Column(name = "component_code", nullable = false, length = 40)
    private String componentCode;

    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "calculation_basis", precision = 19, scale = 4)
    private BigDecimal calculationBasis;

    @Column(name = "applied_rate", precision = 9, scale = 6)
    private BigDecimal appliedRate;

    public UUID getComponentId() {
        return componentId;
    }

    public void setComponentId(UUID v) {
        componentId = v;
    }

    public LandedCostEstimate getEstimate() {
        return estimate;
    }

    public void setEstimate(LandedCostEstimate v) {
        estimate = v;
    }

    public String getComponentCode() {
        return componentCode;
    }

    public void setComponentCode(String v) {
        componentCode = v;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal v) {
        amount = v;
    }

    public String getCurrencyCode() {
        return currencyCode;
    }

    public void setCurrencyCode(String v) {
        currencyCode = v;
    }

    public BigDecimal getCalculationBasis() {
        return calculationBasis;
    }

    public void setCalculationBasis(BigDecimal v) {
        calculationBasis = v;
    }

    public BigDecimal getAppliedRate() {
        return appliedRate;
    }

    public void setAppliedRate(BigDecimal v) {
        appliedRate = v;
    }
}
