package com.cap22.landedcost.exchange;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "exchange_rates")
public class ExchangeRate {
    @Id
    @GeneratedValue
    @Column(name = "exchange_rate_id")
    private UUID exchangeRateId;

    @Column(name = "base_currency", nullable = false, length = 3)
    private String baseCurrency;

    @Column(name = "target_currency", nullable = false, length = 3)
    private String targetCurrency;

    @Column(name = "exchange_rate", nullable = false, precision = 19, scale = 8)
    private BigDecimal exchangeRate;

    @Column(name = "effective_date", nullable = false)
    private LocalDate effectiveDate;

    @Column(nullable = false, length = 60)
    private String source;

    public UUID getExchangeRateId() {
        return exchangeRateId;
    }

    public void setExchangeRateId(UUID v) {
        exchangeRateId = v;
    }

    public String getBaseCurrency() {
        return baseCurrency;
    }

    public void setBaseCurrency(String v) {
        baseCurrency = v;
    }

    public String getTargetCurrency() {
        return targetCurrency;
    }

    public void setTargetCurrency(String v) {
        targetCurrency = v;
    }

    public BigDecimal getExchangeRate() {
        return exchangeRate;
    }

    public void setExchangeRate(BigDecimal v) {
        exchangeRate = v;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate v) {
        effectiveDate = v;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String v) {
        source = v;
    }
}
