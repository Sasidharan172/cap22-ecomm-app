package com.cap22.landedcost.estimate;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import jakarta.validation.constraints.*;

public class EstimateDtos {
    public record CreateReq(
            @NotNull UUID shipmentId,
            LocalDate estimateDate,
            String reportingCurrency,
            BigDecimal shippingCost,
            BigDecimal insuranceCost,
            String requestKey,
            String calculationVersion) {
    }

    public record ComponentRes(
            UUID componentId,
            String componentCode,
            BigDecimal amount,
            String currencyCode,
            BigDecimal calculationBasis,
            BigDecimal appliedRate) {
    }

    public record Res(
            UUID estimateId,
            UUID shipmentId,
            UUID ruleId,
            UUID exchangeRateId,
            Integer estimateVersion,
            BigDecimal productValue,
            BigDecimal shippingCost,
            BigDecimal insuranceCost,
            BigDecimal dutyAmount,
            BigDecimal taxAmount,
            BigDecimal handlingFeeAmount,
            String destinationCurrency,
            BigDecimal destinationLandedCost,
            String reportingCurrency,
            BigDecimal reportingLandedCost,
            String ruleSnapshot,
            String fxSnapshot,
            String calculationVersion,
            String requestKey,
            UUID previousEstimateId,
            LocalDate estimateDate,
            Instant estimatedAt,
            List<ComponentRes> components) {
    }
}
