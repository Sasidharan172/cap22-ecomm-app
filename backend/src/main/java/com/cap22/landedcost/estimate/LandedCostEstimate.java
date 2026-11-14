package com.cap22.landedcost.estimate;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.persistence.*;
import com.cap22.landedcost.shipment.Shipment;
import com.cap22.landedcost.rule.DestinationRule;
import com.cap22.landedcost.exchange.ExchangeRate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "landed_cost_estimates")
public class LandedCostEstimate {

    @Id
    @GeneratedValue
    @Column(name = "estimate_id")
    private UUID estimateId;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "shipment_id")
    private Shipment shipment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    private DestinationRule rule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exchange_rate_id")
    private ExchangeRate exchangeRate;

    @Column(name = "estimate_version", nullable = false)
    private Integer estimateVersion;

    @Column(name = "product_value", nullable = false, precision = 19, scale = 4)
    private BigDecimal productValue;

    @Column(name = "shipping_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal shippingCost;

    @Column(name = "insurance_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal insuranceCost;

    @Column(name = "duty_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal dutyAmount;

    @Column(name = "tax_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal taxAmount;

    @Column(name = "handling_fee_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal handlingFeeAmount;

    @Column(name = "destination_currency", nullable = false, length = 3)
    private String destinationCurrency;

    @Column(name = "destination_landed_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal destinationLandedCost;

    @Column(name = "reporting_currency", nullable = false, length = 3)
    private String reportingCurrency;

    @Column(name = "reporting_landed_cost", nullable = false, precision = 19, scale = 4)
    private BigDecimal reportingLandedCost;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rule_snapshot", columnDefinition = "jsonb")
    private String ruleSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fx_snapshot", columnDefinition = "jsonb")
    private String fxSnapshot;

    @Column(name = "calculation_version", nullable = false, length = 40)
    private String calculationVersion;

    @Column(name = "request_key", length = 120)
    private String requestKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "previous_estimate_id")
    private LandedCostEstimate previousEstimate;

    @Column(name = "estimate_date", nullable = false)
    private LocalDate estimateDate;

    @Column(name = "estimated_at", nullable = false)
    private Instant estimatedAt;

    @OneToMany(mappedBy = "estimate", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<CostEstimateComponent> components = new ArrayList<>();

    @PrePersist
    void pre() {
        if (estimatedAt == null)
            estimatedAt = Instant.now();
        if (calculationVersion == null)
            calculationVersion = "v1";
    }

    public UUID getEstimateId() {
        return estimateId;
    }

    public void setEstimateId(UUID v) {
        estimateId = v;
    }

    public Shipment getShipment() {
        return shipment;
    }

    public void setShipment(Shipment v) {
        shipment = v;
    }

    public DestinationRule getRule() {
        return rule;
    }

    public void setRule(DestinationRule v) {
        rule = v;
    }

    public ExchangeRate getExchangeRate() {
        return exchangeRate;
    }

    public void setExchangeRate(ExchangeRate v) {
        exchangeRate = v;
    }

    public Integer getEstimateVersion() {
        return estimateVersion;
    }

    public void setEstimateVersion(Integer v) {
        estimateVersion = v;
    }

    public BigDecimal getProductValue() {
        return productValue;
    }

    public void setProductValue(BigDecimal v) {
        productValue = v;
    }

    public BigDecimal getShippingCost() {
        return shippingCost;
    }

    public void setShippingCost(BigDecimal v) {
        shippingCost = v;
    }

    public BigDecimal getInsuranceCost() {
        return insuranceCost;
    }

    public void setInsuranceCost(BigDecimal v) {
        insuranceCost = v;
    }

    public BigDecimal getDutyAmount() {
        return dutyAmount;
    }

    public void setDutyAmount(BigDecimal v) {
        dutyAmount = v;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public void setTaxAmount(BigDecimal v) {
        taxAmount = v;
    }

    public BigDecimal getHandlingFeeAmount() {
        return handlingFeeAmount;
    }

    public void setHandlingFeeAmount(BigDecimal v) {
        handlingFeeAmount = v;
    }

    public String getDestinationCurrency() {
        return destinationCurrency;
    }

    public void setDestinationCurrency(String v) {
        destinationCurrency = v;
    }

    public BigDecimal getDestinationLandedCost() {
        return destinationLandedCost;
    }

    public void setDestinationLandedCost(BigDecimal v) {
        destinationLandedCost = v;
    }

    public String getReportingCurrency() {
        return reportingCurrency;
    }

    public void setReportingCurrency(String v) {
        reportingCurrency = v;
    }

    public BigDecimal getReportingLandedCost() {
        return reportingLandedCost;
    }

    public void setReportingLandedCost(BigDecimal v) {
        reportingLandedCost = v;
    }

    public String getRuleSnapshot() {
        return ruleSnapshot;
    }

    public void setRuleSnapshot(String v) {
        ruleSnapshot = v;
    }

    public String getFxSnapshot() {
        return fxSnapshot;
    }

    public void setFxSnapshot(String v) {
        fxSnapshot = v;
    }

    public String getCalculationVersion() {
        return calculationVersion;
    }

    public void setCalculationVersion(String v) {
        calculationVersion = v;
    }

    public String getRequestKey() {
        return requestKey;
    }

    public void setRequestKey(String v) {
        requestKey = v;
    }

    public LandedCostEstimate getPreviousEstimate() {
        return previousEstimate;
    }

    public void setPreviousEstimate(LandedCostEstimate v) {
        previousEstimate = v;
    }

    public LocalDate getEstimateDate() {
        return estimateDate;
    }

    public void setEstimateDate(LocalDate v) {
        estimateDate = v;
    }

    public Instant getEstimatedAt() {
        return estimatedAt;
    }

    public void setEstimatedAt(Instant v) {
        estimatedAt = v;
    }

    public List<CostEstimateComponent> getComponents() {
        return components;
    }

    public void setComponents(List<CostEstimateComponent> v) {
        components = v;
    }
}
