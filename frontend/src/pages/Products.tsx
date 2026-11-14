import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Product } from "../types";
import { money } from "../lib/format";
import Modal from "../components/Modal";

export default function Products() {
    const [items, setItems] = useState<Product[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        sku: "",
        name: "",
        hsCode: "",
        unitPrice: "",
        currency: "USD",
        countryOfOrigin: "",
    });
    const load = async () => setItems(await api.products());
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createProduct({ ...f, unitPrice: Number(f.unitPrice) });
            setOpen(false);
            setF({
                sku: "",
                name: "",
                hsCode: "",
                unitPrice: "",
                currency: "USD",
                countryOfOrigin: "",
            });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Products</h1>
                <button onClick={() => setOpen(true)}>+ New Product</button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>SKU</th>
                            <th>Product Name</th>
                            <th>HS Code</th>
                            <th>Unit Price</th>
                            <th>Currency</th>
                            <th>Country of Origin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((p) => (
                            <tr key={p.productId}>
                                <td>{p.sku}</td>
                                <td>{p.name}</td>
                                <td>{p.hsCode}</td>
                                <td>{money(p.unitPrice)}</td>
                                <td>{p.currency}</td>
                                <td>{p.countryOfOrigin}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={6} className="muted">
                                    No products found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Product"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        SKU
                        <input
                            value={f.sku}
                            onChange={(e) =>
                                setF({ ...f, sku: e.target.value })
                            }
                            required
                            placeholder="e.g. SKU-ABC-001"
                        />
                    </label>
                    <label>
                        Product Name
                        <input
                            value={f.name}
                            onChange={(e) =>
                                setF({ ...f, name: e.target.value })
                            }
                            required
                            placeholder="Product name"
                        />
                    </label>
                    <label>
                        HS Code
                        <input
                            value={f.hsCode}
                            onChange={(e) =>
                                setF({ ...f, hsCode: e.target.value })
                            }
                            required
                            placeholder="e.g. 610910"
                        />
                    </label>
                    <label>
                        Unit Price
                        <input
                            type="number"
                            step="0.0001"
                            value={f.unitPrice}
                            onChange={(e) =>
                                setF({ ...f, unitPrice: e.target.value })
                            }
                            required
                            placeholder="0.00"
                        />
                    </label>
                    <label>
                        Currency (ISO 3)
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
                            placeholder="USD"
                        />
                    </label>
                    <label>
                        Country of Origin (ISO 2)
                        <input
                            value={f.countryOfOrigin}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    countryOfOrigin:
                                        e.target.value.toUpperCase(),
                                })
                            }
                            required
                            maxLength={2}
                            placeholder="IN"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Product</button>
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
