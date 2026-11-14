import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Customer } from "../types";
import Modal from "../components/Modal";

export default function Customers() {
    const [items, setItems] = useState<Customer[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        customerNumber: "",
        name: "",
        email: "",
        countryCode: "",
    });
    const load = async () => setItems(await api.customers());
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createCustomer(f);
            setOpen(false);
            setF({ customerNumber: "", name: "", email: "", countryCode: "" });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Customers</h1>
                <button onClick={() => setOpen(true)}>+ New Customer</button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Customer Number</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Country</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((c) => (
                            <tr key={c.customerId}>
                                <td>{c.customerNumber}</td>
                                <td>{c.name}</td>
                                <td>{c.email || "-"}</td>
                                <td>{c.countryCode}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={4} className="muted">
                                    No customers found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Customer"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Customer Number
                        <input
                            value={f.customerNumber}
                            onChange={(e) =>
                                setF({ ...f, customerNumber: e.target.value })
                            }
                            required
                            placeholder="e.g. CUS-1003"
                        />
                    </label>
                    <label>
                        Full Name
                        <input
                            value={f.name}
                            onChange={(e) =>
                                setF({ ...f, name: e.target.value })
                            }
                            required
                            placeholder="Customer name"
                        />
                    </label>
                    <label>
                        Email Address
                        <input
                            type="email"
                            value={f.email}
                            onChange={(e) =>
                                setF({ ...f, email: e.target.value })
                            }
                            placeholder="name@example.com"
                        />
                    </label>
                    <label>
                        Country Code (ISO 2)
                        <input
                            value={f.countryCode}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    countryCode: e.target.value.toUpperCase(),
                                })
                            }
                            required
                            maxLength={2}
                            placeholder="US"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Customer</button>
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
