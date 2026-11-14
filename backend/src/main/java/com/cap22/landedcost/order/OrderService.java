package com.cap22.landedcost.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.customer.*;
import com.cap22.landedcost.destination.*;
import com.cap22.landedcost.product.*;

@Service
public class OrderService {
    private final OrderRepository orders;
    private final CustomerRepository customers;
    private final DestinationRepository destinations;
    private final ProductRepository products;

    public OrderService(OrderRepository o, CustomerRepository c, DestinationRepository d, ProductRepository p) {
        this.orders = o;
        this.customers = c;
        this.destinations = d;
        this.products = p;
    }

    @Transactional
    public OrderDtos.Res create(OrderDtos.CreateReq r) {

        Customer c = customers.findById(r.customerId())
                .orElseThrow(
                        () -> ApiException
                                .notFound("CUSTOMER_NOT_FOUND", "Customer not found"));

        Destination d = destinations.findById(r.destinationId())
                .orElseThrow(
                        () -> ApiException
                                .notFound("DEST_NOT_FOUND", "Destination not found"));

        OrderEntity o = new OrderEntity();

        o.setOrderNumber(
                r.orderNumber() != null && !r.orderNumber().isBlank()
                        ? r.orderNumber()
                        : "ORD-" + UUID.randomUUID()
                                .toString()
                                .substring(0, 8)
                                .toUpperCase());
        o.setCustomer(c);
        o.setDestination(d);
        o.setCurrency(r.currency().toUpperCase());
        o.setStatus(r.status() != null && !r.status().isBlank()
                ? r.status()
                : "CREATED");
        o.setCreatedAt(Instant.now());

        for (OrderDtos.ItemReq ir : r.items()) {
            Product p = products.findById(ir.productId())
                    .orElseThrow(
                            () -> ApiException.notFound("PRODUCT_NOT_FOUND", "Product not found"));

            OrderItem it = new OrderItem();

            it.setOrder(o);
            it.setProduct(p);
            it.setQuantity(ir.quantity());
            it.setUnitPrice(ir.unitPrice() != null
                    ? ir.unitPrice()
                    : p.getUnitPrice());
            it.setCurrency(o.getCurrency());

            o.getItems().add(it);
        }
        return toRes(orders.save(o));
    }

    @Transactional(readOnly = true)
    public List<OrderDtos.Res> list() {
        return orders.findAllByOrderByCreatedAtDesc().stream().map(this::toRes).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OrderDtos.Res get(UUID id) {
        return toRes(orders.findWithDetailsByOrderId(id)
                .orElseThrow(() -> ApiException.notFound("ORDER_NOT_FOUND", "Order not found")));
    }

    private OrderDtos.Res toRes(OrderEntity o) {

        List<OrderDtos.ItemRes> items = o.getItems().stream()
                .map(i -> new OrderDtos.ItemRes(
                        i.getOrderItemId(),
                        i.getProduct().getProductId(),
                        i.getProduct().getSku(),
                        i.getProduct().getName(),
                        i.getProduct().getHsCode(),
                        i.getQuantity(),
                        i.getUnitPrice(),
                        i.getCurrency(),
                        i.getUnitPrice().multiply(
                                BigDecimal.valueOf(i.getQuantity()))))
                .collect(Collectors.toList());

        BigDecimal total = items.stream()
                .map(OrderDtos.ItemRes::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new OrderDtos.Res(
                o.getOrderId(),
                o.getOrderNumber(),
                o.getCustomer().getCustomerId(),
                o.getCustomer().getName(),
                o.getDestination().getDestinationId(),
                o.getDestination().getCode(),
                o.getDestination().getName(),
                o.getCurrency(),
                o.getStatus(),
                o.getCreatedAt(),
                items,
                total);
    }
}
