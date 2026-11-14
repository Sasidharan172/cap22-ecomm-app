package com.cap22.landedcost.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public class OrderDtos {
    public record ItemReq(
            @NotNull UUID productId,
            @NotNull @Min(1) Integer quantity,
            BigDecimal unitPrice) {
    }

    public record CreateReq(
            String orderNumber,
            @NotNull UUID customerId,
            @NotNull UUID destinationId,
            @NotBlank String currency,
            String status,
            @NotEmpty @Valid List<ItemReq> items) {
    }

    public record ItemRes(
            UUID orderItemId,
            UUID productId,
            String sku,
            String productName,
            String hsCode,
            Integer quantity,
            BigDecimal unitPrice,
            String currency,
            BigDecimal lineTotal) {
    }

    public record Res(
            UUID orderId,
            String orderNumber,
            UUID customerId,
            String customerName,
            UUID destinationId,
            String destinationCode,
            String destinationName,
            String currency,
            String status,
            Instant createdAt,
            List<ItemRes> items,
            BigDecimal totalValue) {
    }
}
