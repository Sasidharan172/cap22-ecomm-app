package com.cap22.landedcost.shipment;

import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.order.*;

@Service
public class ShipmentService {
    private final ShipmentRepository shipments;
    private final OrderRepository orders;
    private final OrderItemRepository orderItems;

    public ShipmentService(
            ShipmentRepository s,
            OrderRepository o,
            OrderItemRepository oi) {

        this.shipments = s;
        this.orders = o;
        this.orderItems = oi;
    }

    @Transactional
    public ShipmentDtos.Res create(ShipmentDtos.CreateReq r) {

        OrderEntity o = orders.findWithDetailsByOrderId(r.orderId())
                .orElseThrow(
                        () -> ApiException
                                .notFound("ORDER_NOT_FOUND", "Order not found"));

        Shipment s = new Shipment();

        s.setOrder(o);
        s.setTrackingNumber(r.trackingNumber());
        s.setCarrier(r.carrier());
        s.setStatus(r.status() != null
                ? r.status()
                : "CREATED");
        s.setExpectedDeliveryAt(r.expectedDeliveryAt());

        for (ShipmentDtos.ItemReq ir : r.items()) {
            OrderItem oi = orderItems.findById(ir.orderItemId())
                    .orElseThrow(
                            () -> ApiException
                                    .notFound("ORDER_ITEM_NOT_FOUND", "Order item not found"));

            if (!oi.getOrder().getOrderId().equals(o.getOrderId()))
                throw ApiException
                        .badRequest("INVALID_ITEM", "Order item does not belong to order");

            ShipmentItem si = new ShipmentItem();
            si.setShipment(s);
            si.setOrderItem(oi);
            si.setQuantityShipped(ir.quantityShipped());
            s.getItems().add(si);
        }
        return toRes(shipments.save(s));
    }

    @Transactional(readOnly = true)
    public List<ShipmentDtos.Res> list() {

        return shipments
                .findAllByOrderByShipmentIdDesc()
                .stream()
                .map(this::toRes)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ShipmentDtos.Res get(UUID id) {
        return toRes(shipments.findWithDetailsByShipmentId(id)
                .orElseThrow(
                        () -> ApiException
                                .notFound("SHIPMENT_NOT_FOUND", "Shipment not found")));
    }

    @Transactional
    public ShipmentDtos.Res updateStatus(UUID id, String status) {
        Shipment s = shipments.findById(id)
                .orElseThrow(
                        () -> ApiException
                                .notFound("SHIPMENT_NOT_FOUND", "Shipment not found"));
        s.setStatus(status);
        shipments.save(s);
        return get(id);
    }

    private ShipmentDtos.Res toRes(Shipment s) {

        List<ShipmentDtos.ItemRes> items = s.getItems() == null
                ? List.of()
                : s.getItems().stream()
                        .map(i -> new ShipmentDtos.ItemRes(
                                i.getShipmentItemId(),
                                i.getOrderItem().getOrderItemId(),
                                i.getOrderItem().getProduct().getSku(),
                                i.getOrderItem().getProduct().getName(),
                                i.getQuantityShipped()))
                        .collect(Collectors.toList());

        String destCode = s.getOrder().getDestination() != null
                ? s.getOrder().getDestination().getCode()
                : null;
        String destName = s.getOrder().getDestination() != null
                ? s.getOrder().getDestination().getName()
                : null;

        return new ShipmentDtos.Res(
                s.getShipmentId(),
                s.getOrder().getOrderId(),
                s.getOrder().getOrderNumber(),
                destCode,
                destName,
                s.getTrackingNumber(),
                s.getCarrier(), s.getStatus(),
                s.getExpectedDeliveryAt(),
                s.getDeliveredAt(),
                items);
    }
}
