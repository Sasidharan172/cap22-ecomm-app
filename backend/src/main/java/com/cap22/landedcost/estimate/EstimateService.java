package com.cap22.landedcost.estimate;

import java.math.*;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cap22.landedcost.common.ApiException;
import com.cap22.landedcost.exchange.*;
import com.cap22.landedcost.rule.*;
import com.cap22.landedcost.shipment.*;

@Service
public class EstimateService {
    private final LandedCostEstimateRepository estimates;
    private final ShipmentRepository shipments;
    private final DestinationRuleRepository rules;
    private final ExchangeRateRepository rates;
    private final ObjectMapper om = new ObjectMapper();

    public EstimateService(
            LandedCostEstimateRepository e,
            ShipmentRepository s,
            DestinationRuleRepository r,
            ExchangeRateRepository x) {

        this.estimates = e;
        this.shipments = s;
        this.rules = r;
        this.rates = x;
    }

    @Transactional
    public EstimateDtos.Res create(EstimateDtos.CreateReq req) {

        if (req.requestKey() != null && !req.requestKey().isBlank()) {
            var existing = estimates
                    .findFirstByShipmentShipmentIdAndRequestKey(req.shipmentId(), req.requestKey());
            if (existing.isPresent())
                return toRes(existing.get());
        }

        Shipment shipment = shipments
                .findWithDetailsByShipmentId(req.shipmentId())
                .orElseThrow(() -> ApiException
                        .notFound("SHIPMENT_NOT_FOUND", "Shipment not found"));

        LocalDate date = req.estimateDate() != null
                ? req.estimateDate()
                : LocalDate.now(ZoneOffset.UTC);

        String orderCurrency = shipment
                .getOrder().getCurrency();
        String destCurrency = shipment
                .getOrder()
                .getDestination()
                .getCurrency();
        String reportingCurrency = (req.reportingCurrency() != null && !req.reportingCurrency().isBlank())
                ? req.reportingCurrency().toUpperCase()
                : destCurrency;

        BigDecimal productValueOrder = BigDecimal.ZERO;
        BigDecimal dutyTotal = BigDecimal.ZERO;
        BigDecimal taxTotal = BigDecimal.ZERO;
        BigDecimal handlingTotal = BigDecimal.ZERO;
        DestinationRule primaryRule = null;

        List<Map<String, Object>> ruleSnaps = new ArrayList<>();

        var activeRules = rules
                .findActiveForDestinationOnDate(
                        shipment.getOrder().getDestination().getDestinationId(),
                        date);

        for (ShipmentItem si : shipment.getItems()) {

            var oi = si.getOrderItem();
            var p = oi.getProduct();

            BigDecimal lineValue = oi
                    .getUnitPrice()
                    .multiply(
                            BigDecimal.valueOf(si.getQuantityShipped()));

            productValueOrder = productValueOrder.add(lineValue);
            DestinationRule match = bestRule(activeRules, p.getHsCode());

            if (primaryRule == null)
                primaryRule = match;

            BigDecimal dutyRate = match != null && match.getDutyRate() != null ? match.getDutyRate() : BigDecimal.ZERO;
            BigDecimal taxRate = match != null && match.getTaxRate() != null ? match.getTaxRate() : BigDecimal.ZERO;
            BigDecimal duty = scale(lineValue.multiply(dutyRate));
            BigDecimal tax = scale(lineValue.add(duty).multiply(taxRate));

            dutyTotal = dutyTotal.add(duty);
            taxTotal = taxTotal.add(tax);

            if (match != null && match.getHandlingFee() != null)
                handlingTotal = handlingTotal.add(match.getHandlingFee());

            ruleSnaps.add(Map.of("orderItemId", oi.getOrderItemId().toString(), "hsCode", p.getHsCode(), "dutyRate",
                    dutyRate, "taxRate", taxRate, "ruleId", match != null ? match.getRuleId().toString() : ""));
        }

        // Avoid double-counting handling fee when same rule applies to multiple lines
        if (primaryRule != null && primaryRule.getHandlingFee() != null)
            handlingTotal = primaryRule.getHandlingFee();
        else
            handlingTotal = BigDecimal.ZERO;

        BigDecimal shipping = req.shippingCost() != null ? req.shippingCost() : BigDecimal.ZERO;
        BigDecimal insurance = req.insuranceCost() != null ? req.insuranceCost() : BigDecimal.ZERO;

        ExchangeRate fxToDest = resolveRate(orderCurrency, destCurrency, date);
        BigDecimal destRate = fxToDest != null
                ? fxToDest.getExchangeRate()
                : (orderCurrency.equals(destCurrency)
                        ? BigDecimal.ONE
                        : BigDecimal.ONE);
        BigDecimal productDest = scale(productValueOrder.multiply(destRate));
        BigDecimal shippingDest = scale(shipping.multiply(destRate));
        BigDecimal insuranceDest = scale(insurance.multiply(destRate));
        BigDecimal dutyDest = scale(dutyTotal.multiply(destRate));
        BigDecimal taxDest = scale(taxTotal.multiply(destRate));
        BigDecimal handlingDest = convertFee(handlingTotal,
                primaryRule != null
                        ? primaryRule.getFeeCurrency()
                        : destCurrency,
                destCurrency, date);
        BigDecimal destLanded = productDest
                .add(shippingDest)
                .add(insuranceDest)
                .add(dutyDest)
                .add(taxDest)
                .add(handlingDest);

        ExchangeRate fxToReport = resolveRate(destCurrency, reportingCurrency, date);
        BigDecimal reportRate = fxToReport != null
                ? fxToReport.getExchangeRate()
                : (destCurrency.equals(reportingCurrency)
                        ? BigDecimal.ONE
                        : BigDecimal.ONE);

        BigDecimal reportingLanded = scale(destLanded.multiply(reportRate));

        Integer prevMax = estimates.maxVersion(shipment.getShipmentId());
        LandedCostEstimate prev = null;
        if (prevMax != null && prevMax > 0) {
            var list = estimates
                    .findByShipmentShipmentIdOrderByEstimateVersionDesc(shipment.getShipmentId());
            if (!list.isEmpty())
                prev = list.get(0);
        }

        LandedCostEstimate e = new LandedCostEstimate();

        e.setShipment(shipment);
        e.setRule(primaryRule);
        e.setExchangeRate(fxToDest != null ? fxToDest : fxToReport);
        e.setEstimateVersion((prevMax == null ? 0 : prevMax) + 1);
        e.setProductValue(productDest);
        e.setShippingCost(shippingDest);
        e.setInsuranceCost(insuranceDest);
        e.setDutyAmount(dutyDest);
        e.setTaxAmount(taxDest);
        e.setHandlingFeeAmount(handlingDest);
        e.setDestinationCurrency(destCurrency);
        e.setDestinationLandedCost(scale(destLanded));
        e.setReportingCurrency(reportingCurrency);
        e.setReportingLandedCost(reportingLanded);
        e.setCalculationVersion(req.calculationVersion() != null ? req.calculationVersion() : "v1");
        e.setRequestKey(req.requestKey());
        e.setPreviousEstimate(prev);
        e.setEstimateDate(date);
        e.setEstimatedAt(Instant.now());
        e.setRuleSnapshot(snap(ruleSnaps));
        e.setFxSnapshot(snap(Map.of("toDestination",
                fxToDest != null ? mapFx(fxToDest)
                        : Map.of("rate", destRate, "pair", orderCurrency + "/" + destCurrency),
                "toReporting", fxToReport != null ? mapFx(fxToReport)
                        : Map.of("rate", reportRate, "pair", destCurrency + "/" + reportingCurrency))));
        addComp(e, "PRODUCT_VALUE", productDest, destCurrency, productValueOrder, destRate);
        addComp(e, "SHIPPING", shippingDest, destCurrency, shipping, destRate);
        addComp(e, "INSURANCE", insuranceDest, destCurrency, insurance, destRate);
        addComp(e, "DUTY", dutyDest, destCurrency, dutyTotal, destRate);
        addComp(e, "TAX", taxDest, destCurrency, taxTotal, destRate);
        addComp(e, "HANDLING_FEE", handlingDest, destCurrency, handlingTotal, null);
        addComp(e, "TOTAL_DESTINATION", scale(destLanded), destCurrency, null, null);
        addComp(e, "TOTAL_REPORTING", reportingLanded, reportingCurrency, scale(destLanded), reportRate);
        return toRes(estimates.save(e));
    }

    @Transactional(readOnly = true)
    public EstimateDtos.Res get(UUID id) {
        return toRes(estimates.findWithDetailsByEstimateId(id)
                .orElseThrow(() -> ApiException.notFound("ESTIMATE_NOT_FOUND", "Estimate not found")));
    }

    @Transactional(readOnly = true)
    public List<EstimateDtos.Res> listForShipment(UUID shipmentId) {
        return estimates.findByShipmentShipmentIdOrderByEstimateVersionDesc(shipmentId).stream().map(this::toRes)
                .toList();
    }

    private DestinationRule bestRule(List<DestinationRule> rules, String hs) {
        DestinationRule best = null;
        int bestLen = -1;
        for (DestinationRule r : rules) {
            String p = r.getHsPrefix() == null ? "" : r.getHsPrefix();
            if (hs != null && hs.startsWith(p) && p.length() > bestLen) {
                best = r;
                bestLen = p.length();
            }
        }
        if (best == null) {
            for (DestinationRule r : rules) {
                if (r.getHsPrefix() == null || r.getHsPrefix().isBlank())
                    return r;
            }
        }
        return best;
    }

    private ExchangeRate resolveRate(String base, String target, LocalDate d) {
        if (base.equals(target))
            return null;
        var list = rates.findApplicable(base, target, d);
        return list.isEmpty() ? null : list.get(0);
    }

    private BigDecimal convertFee(BigDecimal amount, String from, String to, LocalDate d) {
        if (from == null)
            from = to;
        if (from.equals(to))
            return scale(amount);
        ExchangeRate fx = resolveRate(from, to, d);
        BigDecimal r = fx != null ? fx.getExchangeRate() : BigDecimal.ONE;
        return scale(amount.multiply(r));
    }

    private BigDecimal scale(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(4, RoundingMode.HALF_UP);
    }

    private void addComp(LandedCostEstimate e, String code, BigDecimal amount, String currency, BigDecimal basis,
            BigDecimal rate) {
        CostEstimateComponent c = new CostEstimateComponent();
        c.setEstimate(e);
        c.setComponentCode(code);
        c.setAmount(scale(amount));
        c.setCurrencyCode(currency);
        c.setCalculationBasis(basis == null ? null : scale(basis));
        c.setAppliedRate(rate == null ? null : rate.setScale(6, RoundingMode.HALF_UP));
        e.getComponents().add(c);
    }

    private String snap(Object o) {
        try {
            return om.writeValueAsString(o);
        } catch (Exception ex) {
            return null;
        }
    }

    private Map<String, Object> mapFx(ExchangeRate fx) {
        return Map.of("exchangeRateId", fx.getExchangeRateId().toString(), "baseCurrency", fx.getBaseCurrency(),
                "targetCurrency", fx.getTargetCurrency(), "exchangeRate", fx.getExchangeRate(), "effectiveDate",
                fx.getEffectiveDate().toString(), "source", fx.getSource());
    }

    private EstimateDtos.Res toRes(LandedCostEstimate e) {
        List<EstimateDtos.ComponentRes> comps = e.getComponents() == null ? List.of()
                : e.getComponents().stream()
                        .map(c -> new EstimateDtos.ComponentRes(
                                c.getComponentId(),
                                c.getComponentCode(),
                                c.getAmount(),
                                c.getCurrencyCode(),
                                c.getCalculationBasis(),
                                c.getAppliedRate()))
                        .collect(Collectors.toList());

        return new EstimateDtos.Res(
                e.getEstimateId(),
                e.getShipment().getShipmentId(),
                e.getRule() != null
                        ? e.getRule().getRuleId()
                        : null,
                e.getExchangeRate() != null
                        ? e.getExchangeRate().getExchangeRateId()
                        : null,
                e.getEstimateVersion(),
                e.getProductValue(),
                e.getShippingCost(),
                e.getInsuranceCost(),
                e.getDutyAmount(),
                e.getTaxAmount(),
                e.getHandlingFeeAmount(),
                e.getDestinationCurrency(),
                e.getDestinationLandedCost(),
                e.getReportingCurrency(),
                e.getReportingLandedCost(),
                e.getRuleSnapshot(),
                e.getFxSnapshot(),
                e.getCalculationVersion(),
                e.getRequestKey(),
                e.getPreviousEstimate() != null
                        ? e.getPreviousEstimate().getEstimateId()
                        : null,
                e.getEstimateDate(),
                e.getEstimatedAt(), comps);
    }
}
