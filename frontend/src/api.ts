import type * as T from "./types";
import { authHeader, clearAuth } from "./lib/auth";
const BASE = "";
async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...authHeader(),
            ...(init?.headers || {}),
        },
        ...init,
    });
    if (res.status === 401) {
        clearAuth();
        window.dispatchEvent(new Event("auth:logout"));
        throw new Error("Unauthorized - please log in");
    }
    if (!res.ok) {
        let msg = res.statusText;
        try {
            const j = await res.json();
            msg = j.message || j.error || msg;
        } catch {}
        throw new Error(msg);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}
export const api = {
    customers: () => req<T.Customer[]>("/api/customers"),
    createCustomer: (b: any) =>
        req<T.Customer>("/api/customers", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    destinations: () => req<T.Destination[]>("/api/destinations"),
    createDestination: (b: any) =>
        req<T.Destination>("/api/destinations", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    products: () => req<T.Product[]>("/api/products"),
    createProduct: (b: any) =>
        req<T.Product>("/api/products", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    orders: () => req<T.Order[]>("/api/orders"),
    order: (id: string) => req<T.Order>(`/api/orders/${id}`),
    createOrder: (b: any) =>
        req<T.Order>("/api/orders", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    shipments: () => req<T.Shipment[]>("/api/shipments"),
    shipment: (id: string) => req<T.Shipment>(`/api/shipments/${id}`),
    createShipment: (b: any) =>
        req<T.Shipment>("/api/shipments", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    updateShipmentStatus: (id: string, status: string) =>
        req<T.Shipment>(`/api/shipments/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        }),
    rules: (destinationId?: string) =>
        req<T.DestinationRule[]>(
            `/api/destination-rules${destinationId ? `?destinationId=${destinationId}` : ""}`,
        ),
    createRule: (b: any) =>
        req<T.DestinationRule>("/api/destination-rules", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    exchangeRates: () => req<T.ExchangeRate[]>("/api/exchange-rates"),
    createExchangeRate: (b: any) =>
        req<T.ExchangeRate>("/api/exchange-rates", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    estimatesForShipment: (shipmentId: string) =>
        req<T.Estimate[]>(`/api/shipments/${shipmentId}/estimates`),
    estimate: (id: string) => req<T.Estimate>(`/api/estimates/${id}`),
    createEstimate: (b: any) =>
        req<T.Estimate>("/api/estimates", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    documentTypes: () => req<T.DocumentType[]>("/api/document-types"),
    createDocumentType: (b: any) =>
        req<T.DocumentType>("/api/document-types", {
            method: "POST",
            body: JSON.stringify(b),
        }),
    shipmentDocuments: (shipmentId: string) =>
        req<T.ShipmentDocument[]>(`/api/shipments/${shipmentId}/documents`),
    addShipmentDocument: (shipmentId: string, b: any) =>
        req<T.ShipmentDocument>(`/api/shipments/${shipmentId}/documents`, {
            method: "POST",
            body: JSON.stringify(b),
        }),
    carrierEvents: (shipmentId: string) =>
        req<T.CarrierEvent[]>(`/api/shipments/${shipmentId}/carrier-events`),
    addCarrierEvent: (shipmentId: string, b: any) =>
        req<T.CarrierEvent>(`/api/shipments/${shipmentId}/carrier-events`, {
            method: "POST",
            body: JSON.stringify(b),
        }),
    exceptions: () => req<T.ShipmentException[]>("/api/exceptions"),
    shipmentExceptions: (shipmentId: string) =>
        req<T.ShipmentException[]>(`/api/shipments/${shipmentId}/exceptions`),
    createException: (shipmentId: string, b: any) =>
        req<T.ShipmentException>(`/api/shipments/${shipmentId}/exceptions`, {
            method: "POST",
            body: JSON.stringify(b),
        }),
    resolveException: (id: string) =>
        req<T.ShipmentException>(`/api/exceptions/${id}/resolve`, {
            method: "PATCH",
        }),
};
