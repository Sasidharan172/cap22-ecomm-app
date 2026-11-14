import { useEffect, useState } from "react";
import { api } from "../api";
import { money } from "../lib/format";

export default function Dashboard() {
    const [d, setD] = useState<any>({});
    const [err, setErr] = useState("");
    useEffect(() => {
        (async () => {
            try {
                const [
                    customers,
                    destinations,
                    products,
                    orders,
                    shipments,
                    rules,
                    exchangeRates,
                    exceptions,
                    docTypes,
                ] = await Promise.all([
                    api.customers(),
                    api.destinations(),
                    api.products(),
                    api.orders(),
                    api.shipments(),
                    api.rules(),
                    api.exchangeRates(),
                    api.exceptions(),
                    api.documentTypes(),
                ]);
                const openExc = exceptions.filter(
                    (e: any) => e.status !== "RESOLVED",
                ).length;
                const inTransit = shipments.filter((s: any) =>
                    ["IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(s.status),
                ).length;
                const totalOrderValue = orders.reduce(
                    (sum: number, o: any) => sum + Number(o.totalValue || 0),
                    0,
                );
                let estimatesCount = 0;
                let latest: any = null;
                for (const s of shipments.slice(0, 5)) {
                    try {
                        const es = await api.estimatesForShipment(s.shipmentId);
                        estimatesCount += es.length;
                        if (
                            es[0] &&
                            (!latest || es[0].estimatedAt > latest.estimatedAt)
                        )
                            latest = es[0];
                    } catch {}
                }
                setD({
                    customers: customers.length,
                    destinations: destinations.length,
                    products: products.length,
                    orders: orders.length,
                    shipments: shipments.length,
                    rules: rules.length,
                    exchangeRates: exchangeRates.length,
                    exceptions: exceptions.length,
                    openExc,
                    inTransit,
                    totalOrderValue,
                    estimatesCount,
                    docTypes: docTypes.length,
                    latest,
                });
            } catch (e: any) {
                setErr(e.message);
            }
        })();
    }, []);
    return (
        <div>
            <h1>Dashboard</h1>
            <p className="muted">
                Operational overview across customers, orders, shipments,
                landed-cost estimates, and exceptions.
            </p>
            {err && <div className="error">{err}</div>}
            <div className="grid cards">
                {[
                    ["Customers", d.customers],
                    ["Destinations", d.destinations],
                    ["Products", d.products],
                    ["Orders", d.orders],
                    ["Shipments", d.shipments],
                    ["In Transit", d.inTransit],
                    ["Destination Rules", d.rules],
                    ["Exchange Rates", d.exchangeRates],
                    ["Document Types", d.docTypes],
                    ["Exceptions", d.exceptions],
                    ["Open Exceptions", d.openExc],
                    ["Recent Estimates", d.estimatesCount],
                ].map(([k, v]) => (
                    <div key={String(k)} className="card">
                        <div className="k">{k}</div>
                        <div className="v">{v ?? "-"}</div>
                    </div>
                ))}
            </div>
            <div className="grid two">
                <div className="card">
                    <h3>Commercial Snapshot</h3>
                    <p>
                        <strong>Total order value (listed):</strong>{" "}
                        {money(d.totalOrderValue || 0)}
                    </p>
                    <p className="muted">
                        Sum of order item values from current orders (in their
                        respective order currencies).
                    </p>
                </div>
                <div className="card">
                    <h3>Latest Landed Cost Estimate</h3>
                    {d.latest ? (
                        <>
                            <p>
                                <strong>Version:</strong> v
                                {d.latest.estimateVersion}
                            </p>
                            <p>
                                <strong>Destination landed cost:</strong>{" "}
                                {money(
                                    d.latest.destinationLandedCost,
                                    d.latest.destinationCurrency,
                                )}
                            </p>
                            <p>
                                <strong>Reporting landed cost:</strong>{" "}
                                {money(
                                    d.latest.reportingLandedCost,
                                    d.latest.reportingCurrency,
                                )}
                            </p>
                            <p className="muted">
                                Shipment{" "}
                                {String(d.latest.shipmentId).slice(0, 8)} ·{" "}
                                {d.latest.estimateDate}
                            </p>
                        </>
                    ) : (
                        <p className="muted">
                            No estimates found yet. Create one from the
                            Estimates page.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
