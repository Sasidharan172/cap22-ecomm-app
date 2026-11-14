import React, { createContext, useContext, useMemo, useState } from "react";
import type * as T from "../types";

type State = {
    customers: T.Customer[];
    setCustomers: (v: T.Customer[]) => void;
    destinations: T.Destination[];
    setDestinations: (v: T.Destination[]) => void;
    products: T.Product[];
    setProducts: (v: T.Product[]) => void;
    orders: T.Order[];
    setOrders: (v: T.Order[]) => void;
    shipments: T.Shipment[];
    setShipments: (v: T.Shipment[]) => void;
    rules: T.DestinationRule[];
    setRules: (v: T.DestinationRule[]) => void;
    exchangeRates: T.ExchangeRate[];
    setExchangeRates: (v: T.ExchangeRate[]) => void;
    documentTypes: T.DocumentType[];
    setDocumentTypes: (v: T.DocumentType[]) => void;
};
const Ctx = createContext<State | null>(null);
export function StoreProvider({ children }: { children: React.ReactNode }) {
    const [customers, setCustomers] = useState<T.Customer[]>([]);
    const [destinations, setDestinations] = useState<T.Destination[]>([]);
    const [products, setProducts] = useState<T.Product[]>([]);
    const [orders, setOrders] = useState<T.Order[]>([]);
    const [shipments, setShipments] = useState<T.Shipment[]>([]);
    const [rules, setRules] = useState<T.DestinationRule[]>([]);
    const [exchangeRates, setExchangeRates] = useState<T.ExchangeRate[]>([]);
    const [documentTypes, setDocumentTypes] = useState<T.DocumentType[]>([]);
    const v = useMemo(
        () => ({
            customers,
            setCustomers,
            destinations,
            setDestinations,
            products,
            setProducts,
            orders,
            setOrders,
            shipments,
            setShipments,
            rules,
            setRules,
            exchangeRates,
            setExchangeRates,
            documentTypes,
            setDocumentTypes,
        }),
        [
            customers,
            destinations,
            products,
            orders,
            shipments,
            rules,
            exchangeRates,
            documentTypes,
        ],
    );
    return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useStore() {
    const v = useContext(Ctx);
    if (!v) throw new Error("StoreProvider missing");
    return v;
}
