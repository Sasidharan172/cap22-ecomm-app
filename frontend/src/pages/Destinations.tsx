import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Destination } from "../types";
import Modal from "../components/Modal";

export default function Destinations() {
    const [items, setItems] = useState<Destination[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({ code: "", name: "", currency: "" });
    const load = async () => setItems(await api.destinations());
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createDestination(f);
            setOpen(false);
            setF({ code: "", name: "", currency: "" });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Destinations</h1>
                <button onClick={() => setOpen(true)}>+ New Destination</button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Country Code</th>
                            <th>Destination Name</th>
                            <th>Currency</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((d) => (
                            <tr key={d.destinationId}>
                                <td>{d.code}</td>
                                <td>{d.name}</td>
                                <td>{d.currency}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={3} className="muted">
                                    No destinations found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Destination"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Destination Code (ISO 2)
                        <input
                            value={f.code}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    code: e.target.value.toUpperCase(),
                                })
                            }
                            required
                            maxLength={2}
                            placeholder="e.g. DE"
                        />
                    </label>

                    <label>
                        Destination Name
                        <input
                            value={f.name}
                            onChange={(e) =>
                                setF({ ...f, name: e.target.value })
                            }
                            required
                            placeholder="e.g. Germany"
                        />
                    </label>
                    <label>
                        Default Currency (ISO 3)
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
                            placeholder="e.g. EUR"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Destination</button>
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
