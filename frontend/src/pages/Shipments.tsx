import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Order, Shipment } from "../types";
import { dt } from "../lib/format";
import Modal from "../components/Modal";

export default function Shipments() {
    const [items, setItems] = useState<Shipment[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        orderId: "",
        trackingNumber: "",
        carrier: "",
        status: "CREATED",
        expectedDeliveryAt: "",
    });
    const [query, setQuery] = useState("");
    const [selOrder, setSelOrder] = useState<Order | null>(null);
    const [alloc, setAlloc] = useState<Record<string, number>>({});
    const load = async () => {
        const [s, o] = await Promise.all([api.shipments(), api.orders()]);
        setItems(s);
        setOrders(o);
    };
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    useEffect(() => {
        const o = orders.find((x) => x.orderId === f.orderId) || null;
        setSelOrder(o);
        const a: Record<string, number> = {};
        o?.items.forEach((i) => (a[i.orderItemId] = i.quantity));
        setAlloc(a);
    }, [f.orderId, orders]);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            const itemsReq = Object.entries(alloc)
                .filter(([, q]) => Number(q) > 0)
                .map(([orderItemId, quantityShipped]) => ({
                    orderItemId,
                    quantityShipped: Number(quantityShipped),
                }));
            await api.createShipment({
                ...f,
                expectedDeliveryAt: f.expectedDeliveryAt
                    ? new Date(f.expectedDeliveryAt).toISOString()
                    : undefined,
                items: itemsReq,
            });
            setOpen(false);
            setF({
                orderId: "",
                trackingNumber: "",
                carrier: "",
                status: "CREATED",
                expectedDeliveryAt: "",
            });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    const visible = items.filter((s) =>
        `${s.trackingNumber} ${s.orderNumber} ${s.destinationCode} ${s.carrier} ${s.status}`
            .toLowerCase()
            .includes(query.toLowerCase()),
    );
    return (
        <div>
            <div className="page-head">
                <div>
                    <h1>Shipments</h1>
                    <p>
                        Track fulfilment records, shipment contents and delivery
                        status.
                    </p>
                </div>
                <button onClick={() => setOpen(true)}>+ New Shipment</button>
            </div>
            <div className="toolbar">
                <input
                    aria-label="Search shipments"
                    placeholder="Search tracking, order, carrier or status…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <span className="muted">
                    {visible.length} of {items.length} shipments
                </span>
            </div>
            {err && <div className="error">{err}</div>}
            {visible.map((s) => (
                <div key={s.shipmentId} className="card shipment-card">
                    <div className="row">
                        <div>
                            <strong>{s.trackingNumber}</strong>
                            <div className="muted shipment-sub">
                                {s.carrier} · Order {s.orderNumber}
                            </div>
                        </div>
                        <div className="shipment-actions">
                            <span className="badge">{s.status}</span>
                            <select
                                aria-label={`Update status for ${s.trackingNumber}`}
                                value={s.status}
                                onChange={async (e) => {
                                    try {
                                        await api.updateShipmentStatus(
                                            s.shipmentId,
                                            e.target.value,
                                        );
                                        await load();
                                    } catch (ex: any) {
                                        setErr(ex.message);
                                    }
                                }}
                            >
                                <option value="CREATED">Created</option>
                                <option value="IN_TRANSIT">In transit</option>
                                <option value="OUT_FOR_DELIVERY">
                                    Out for delivery
                                </option>
                                <option value="DELIVERED">Delivered</option>
                                <option value="EXCEPTION">Exception</option>
                            </select>
                        </div>
                    </div>
                    <div className="shipment-meta">
                        <span>
                            Destination{" "}
                            <strong>
                                {s.destinationCode} · {s.destinationName}
                            </strong>
                        </span>
                        <span>
                            Expected <strong>{dt(s.expectedDeliveryAt)}</strong>
                        </span>
                        <span>
                            Delivered <strong>{dt(s.deliveredAt)}</strong>
                        </span>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Product</th>
                                    <th>Quantity Shipped</th>
                                </tr>
                            </thead>
                            <tbody>
                                {s.items.map((it) => (
                                    <tr key={it.shipmentItemId}>
                                        <td>{it.sku}</td>
                                        <td>{it.productName}</td>
                                        <td>{it.quantityShipped}</td>
                                    </tr>
                                ))}
                                {s.items.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="muted">
                                            No shipment items
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
            {visible.length === 0 && (
                <div className="card empty-state">
                    {items.length === 0
                        ? "No shipments yet. Create a shipment from an existing order."
                        : "No shipments match your search."}
                </div>
            )}

            <Modal
                open={open}
                title="Create Shipment"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Order
                        <select
                            value={f.orderId}
                            onChange={(e) =>
                                setF({ ...f, orderId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select order</option>
                            {orders.map((o) => (
                                <option key={o.orderId} value={o.orderId}>
                                    {o.orderNumber} ({o.customerName},{" "}
                                    {o.destinationCode})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Tracking Number
                        <input
                            value={f.trackingNumber}
                            onChange={(e) =>
                                setF({ ...f, trackingNumber: e.target.value })
                            }
                            required
                            placeholder="e.g. TRK-12345"
                        />
                    </label>
                    <label>
                        Carrier
                        <input
                            value={f.carrier}
                            onChange={(e) =>
                                setF({ ...f, carrier: e.target.value })
                            }
                            required
                            placeholder="e.g. DHL, UPS"
                        />
                    </label>
                    <label>
                        Shipment Status
                        <input
                            value={f.status}
                            onChange={(e) =>
                                setF({ ...f, status: e.target.value })
                            }
                            placeholder="e.g. CREATED, IN_TRANSIT"
                        />
                    </label>
                    <label>
                        Expected Delivery At
                        <input
                            type="datetime-local"
                            value={f.expectedDeliveryAt}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    expectedDeliveryAt: e.target.value,
                                })
                            }
                        />
                    </label>
                    {selOrder && (
                        <div className="card" style={{ margin: 0 }}>
                            <h4 style={{ marginTop: 0 }}>
                                Allocate Shipment Items
                            </h4>
                            <p className="muted">
                                Specify quantity shipped for each order item.
                            </p>
                            {selOrder.items.map((it) => (
                                <label key={it.orderItemId}>
                                    {it.sku} - {it.productName} (ordered:{" "}
                                    {it.quantity})
                                    <input
                                        type="number"
                                        min={0}
                                        max={it.quantity}
                                        value={alloc[it.orderItemId] ?? 0}
                                        onChange={(e) =>
                                            setAlloc({
                                                ...alloc,
                                                [it.orderItemId]: Number(
                                                    e.target.value,
                                                ),
                                            })
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="inline">
                        <button type="submit">Create Shipment</button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
