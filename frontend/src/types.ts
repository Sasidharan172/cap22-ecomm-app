export interface Customer {
    customerId: string;
    customerNumber: string;
    name: string;
    email?: string;
    countryCode: string;
}
export interface Destination {
    destinationId: string;
    code: string;
    name: string;
    currency: string;
}
export interface Product {
    productId: string;
    sku: string;
    name: string;
    hsCode: string;
    unitPrice: number;
    currency: string;
    countryOfOrigin: string;
}
export interface OrderItem {
    orderItemId: string;
    productId: string;
    sku: string;
    productName: string;
    hsCode: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    lineTotal: number;
}
export interface Order {
    orderId: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    destinationId: string;
    destinationCode: string;
    destinationName: string;
    currency: string;
    status: string;
    createdAt: string;
    items: OrderItem[];
    totalValue: number;
}
export interface ShipmentItem {
    shipmentItemId: string;
    orderItemId: string;
    sku: string;
    productName: string;
    quantityShipped: number;
}
export interface Shipment {
    shipmentId: string;
    orderId: string;
    orderNumber: string;
    destinationCode: string;
    destinationName: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    expectedDeliveryAt?: string;
    deliveredAt?: string;
    items: ShipmentItem[];
}
export interface DestinationRule {
    ruleId: string;
    destinationId: string;
    destinationCode: string;
    hsPrefix: string;
    dutyRate: number;
    taxRate: number;
    handlingFee: number;
    feeCurrency: string;
    effectiveFrom: string;
    effectiveTo?: string;
    active: boolean;
}
export interface ExchangeRate {
    exchangeRateId: string;
    baseCurrency: string;
    targetCurrency: string;
    exchangeRate: number;
    effectiveDate: string;
    source: string;
}
export interface CostComponent {
    componentId: string;
    componentCode: string;
    amount: number;
    currencyCode: string;
    calculationBasis?: number;
    appliedRate?: number;
}
export interface Estimate {
    estimateId: string;
    shipmentId: string;
    ruleId?: string;
    exchangeRateId?: string;
    estimateVersion: number;
    productValue: number;
    shippingCost: number;
    insuranceCost: number;
    dutyAmount: number;
    taxAmount: number;
    handlingFeeAmount: number;
    destinationCurrency: string;
    destinationLandedCost: number;
    reportingCurrency: string;
    reportingLandedCost: number;
    ruleSnapshot?: string;
    fxSnapshot?: string;
    calculationVersion: string;
    requestKey?: string;
    previousEstimateId?: string;
    estimateDate: string;
    estimatedAt: string;
    components: CostComponent[];
}
export interface DocumentType {
    documentTypeId: string;
    code: string;
    name: string;
}
export interface ShipmentDocument {
    shipmentDocumentId: string;
    shipmentId: string;
    documentTypeId: string;
    documentTypeCode: string;
    documentTypeName: string;
    verificationStatus: string;
    receivedAt: string;
}
export interface CarrierEvent {
    carrierEventId: string;
    shipmentId: string;
    externalEventId?: string;
    rawEventCode: string;
    normalizedEventType: string;
    occurredAt: string;
    receivedAt: string;
    isDuplicate: boolean;
    isEffective: boolean;
}
export interface ShipmentException {
    exceptionId: string;
    shipmentId: string;
    exceptionType: string;
    severity: string;
    status: string;
    summary: string;
    openedAt: string;
    resolvedAt?: string;
}
