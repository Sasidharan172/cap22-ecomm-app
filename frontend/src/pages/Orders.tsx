import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Customer, Destination, Order, Product } from "../types";
import { dt, money } from "../lib/format";
import Modal from "../components/Modal";

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        orderNumber: "",
        customerId: "",
        destinationId: "",
        currency: "USD",
        status: "CREATED",
    });
    const [lines, setLines] = useState([
        { productId: "", quantity: 1, unitPrice: "" },
    ]);
    const load = async () => {
        const [o, c, d, p] = await Promise.all([
            api.orders(),
            api.customers(),
            api.destinations(),
            api.products(),
        ]);
        setOrders(o);
        setCustomers(c);
        setDestinations(d);
        setProducts(p);
    };
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const addLine = () =>
        setLines([...lines, { productId: "", quantity: 1, unitPrice: "" }]);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createOrder({
                ...f,
                items: lines
                    .filter((l) => l.productId)
                    .map((l) => ({
                        productId: l.productId,
                        quantity: Number(l.quantity),
                        unitPrice:
                            l.unitPrice === ""
                                ? undefined
                                : Number(l.unitPrice),
                    })),
            });
            setOpen(false);
            setF({
                orderNumber: "",
                customerId: "",
                destinationId: "",
                currency: "USD",
                status: "CREATED",
            });
            setLines([{ productId: "", quantity: 1, unitPrice: "" }]);
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Orders</h1>
                <button onClick={() => setOpen(true)}>+ New Order</button>
            </div>
            {err && <div className="error">{err}</div>}
            {orders.map((o) => (
                <div key={o.orderId} className="card">
                    <div className="row">
                        <strong>{o.orderNumber}</strong>
                        <span className="badge">{o.status}</span>
                    </div>
                    <div className="muted">
                        Customer: {o.customerName} · Destination:{" "}
                        {o.destinationCode} ({o.destinationName}) · Currency:{" "}
                        {o.currency} · Created: {dt(o.createdAt)}
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Product</th>
                                    <th>HS Code</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {o.items.map((it) => (
                                    <tr key={it.orderItemId}>
                                        <td>{it.sku}</td>
                                        <td>{it.productName}</td>
                                        <td>{it.hsCode}</td>
                                        <td>{it.quantity}</td>
                                        <td>
                                            {money(it.unitPrice, it.currency)}
                                        </td>
                                        <td>
                                            {money(it.lineTotal, it.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <strong>
                            Order Total: {money(o.totalValue, o.currency)}
                        </strong>
                    </div>
                </div>
            ))}
            {orders.length === 0 && (
                <div className="card muted" style={{ textAlign: "center" }}>
                    No orders found
                </div>
            )}

            <Modal
                open={open}
                title="Create Order"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Order Number (optional)
                        <input
                            placeholder="Leave blank to auto-generate"
                            value={f.orderNumber}
                            onChange={(e) =>
                                setF({ ...f, orderNumber: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Customer
                        <select
                            value={f.customerId}
                            onChange={(e) =>
                                setF({ ...f, customerId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select customer</option>
                            {customers.map((c) => (
                                <option key={c.customerId} value={c.customerId}>
                                    {c.customerNumber} - {c.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Destination
                        <select
                            value={f.destinationId}
                            onChange={(e) =>
                                setF({ ...f, destinationId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select destination</option>
                            {destinations.map((d) => (
                                <option
                                    key={d.destinationId}
                                    value={d.destinationId}
                                >
                                    {d.code} - {d.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Order Currency (ISO 3)
                        <input
                            value={f.currency}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    currency: e.target.value.toUpperCase(),
                                })
                            }
                            required
                            maxLength={3}
                        />
                    </label>
                    <label>
                        Status
                        <input
                            value={f.status}
                            onChange={(e) =>
                                setF({ ...f, status: e.target.value })
                            }
                            placeholder="e.g. CREATED"
                        />
                    </label>
                    <h4>Order Items</h4>
                    {lines.map((l, i) => (
                        <div key={i} className="card" style={{ margin: 0 }}>
                            <label>
                                Product
                                <select
                                    value={l.productId}
                                    onChange={(e) => {
                                        const n = [...lines];
                                        n[i].productId = e.target.value;
                                        const p = products.find(
                                            (x) =>
                                                x.productId === e.target.value,
                                        );
                                        if (p)
                                            n[i].unitPrice = String(
                                                p.unitPrice,
                                            );
                                        setLines(n);
                                    }}
                                    required
                                >
                                    <option value="">Select product</option>
                                    {products.map((p) => (
                                        <option
                                            key={p.productId}
                                            value={p.productId}
                                        >
                                            {p.sku} - {p.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Quantity
                                <input
                                    type="number"
                                    min={1}
                                    value={l.quantity}
                                    onChange={(e) => {
                                        const n = [...lines];
                                        n[i].quantity = Number(e.target.value);
                                        setLines(n);
                                    }}
                                    required
                                />
                            </label>
                            <label>
                                Unit Price (optional override)
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={l.unitPrice}
                                    onChange={(e) => {
                                        const n = [...lines];
                                        n[i].unitPrice = e.target.value;
                                        setLines(n);
                                    }}
                                    placeholder="Defaults to product price"
                                />
                            </label>
                        </div>
                    ))}
                    <div className="inline">
                        <button
                            type="button"
                            className="secondary"
                            onClick={addLine}
                        >
                            + Add Item
                        </button>
                    </div>
                    <div className="inline">
                        <button type="submit">Create Order</button>
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
