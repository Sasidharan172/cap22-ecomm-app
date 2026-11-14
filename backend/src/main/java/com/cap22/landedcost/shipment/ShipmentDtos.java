package com.cap22.landedcost.shipment;

import java.time.Instant;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public class ShipmentDtos {
    public record ItemReq(
            @NotNull UUID orderItemId,
            @NotNull @Min(1) Integer quantityShipped) {
    }

    public record CreateReq(
            @NotNull UUID orderId,
            @NotBlank String trackingNumber,
            @NotBlank String carrier,
            String status,
            Instant expectedDeliveryAt,
            @NotEmpty @Valid List<ItemReq> items) {
    }

    public record ItemRes(
            UUID shipmentItemId,
            UUID orderItemId,
            String sku,
            String productName,
            Integer quantityShipped) {
    }

    public record Res(
            UUID shipmentId,
            UUID orderId,
            String orderNumber,
            String destinationCode,
            String destinationName,
            String trackingNumber,
            String carrier,
            String status,
            Instant expectedDeliveryAt,
            Instant deliveredAt,
            List<ItemRes> items) {
    }
}
