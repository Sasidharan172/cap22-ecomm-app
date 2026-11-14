import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Destination, DestinationRule } from "../types";
import Modal from "../components/Modal";
export default function Rules() {
    const [items, setItems] = useState<DestinationRule[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        destinationId: "",
        hsPrefix: "",
        dutyRate: "0",
        taxRate: "0",
        handlingFee: "0",
        feeCurrency: "USD",
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: "",
        active: true,
    });
    const load = async () => {
        const [r, d] = await Promise.all([api.rules(), api.destinations()]);
        setItems(r);
        setDestinations(d);
    };
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createRule({
                ...f,
                dutyRate: Number(f.dutyRate),
                taxRate: Number(f.taxRate),
                handlingFee: Number(f.handlingFee),
                effectiveTo: f.effectiveTo || null,
            });
            setOpen(false);
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Destination Rules</h1>
                <button onClick={() => setOpen(true)}>+ New Rule</button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Destination</th>
                            <th>HS Prefix</th>
                            <th>Duty Rate</th>
                            <th>Tax Rate</th>
                            <th>Handling Fee</th>
                            <th>Fee Currency</th>
                            <th>Effective From</th>
                            <th>Effective To</th>
                            <th>Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((r) => (
                            <tr key={r.ruleId}>
                                <td>{r.destinationCode}</td>
                                <td>{r.hsPrefix || "(default)"}</td>
                                <td>{r.dutyRate}</td>
                                <td>{r.taxRate}</td>
                                <td>{r.handlingFee}</td>
                                <td>{r.feeCurrency}</td>
                                <td>{r.effectiveFrom}</td>
                                <td>{r.effectiveTo || "-"}</td>
                                <td>{String(r.active)}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={9} className="muted">
                                    No destination rules found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Destination Rule"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
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
                        HS Code Prefix (blank for default)
                        <input
                            value={f.hsPrefix}
                            onChange={(e) =>
                                setF({ ...f, hsPrefix: e.target.value })
                            }
                            placeholder="e.g. 6109"
                        />
                    </label>
                    <label>
                        Duty Rate
                        <input
                            type="number"
                            step="0.000001"
                            value={f.dutyRate}
                            onChange={(e) =>
                                setF({ ...f, dutyRate: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Tax Rate
                        <input
                            type="number"
                            step="0.000001"
                            value={f.taxRate}
                            onChange={(e) =>
                                setF({ ...f, taxRate: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Handling Fee
                        <input
                            type="number"
                            step="0.01"
                            value={f.handlingFee}
                            onChange={(e) =>
                                setF({ ...f, handlingFee: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Fee Currency (ISO 3)
                        <input
                            value={f.feeCurrency}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    feeCurrency: e.target.value.toUpperCase(),
                                })
                            }
                            maxLength={3}
                            required
                        />
                    </label>
                    <label>
                        Effective From
                        <input
                            type="date"
                            value={f.effectiveFrom}
                            onChange={(e) =>
                                setF({ ...f, effectiveFrom: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Effective To (optional)
                        <input
                            type="date"
                            value={f.effectiveTo}
                            onChange={(e) =>
                                setF({ ...f, effectiveTo: e.target.value })
                            }
                        />
                    </label>
                    <label className="row">
                        <input
                            type="checkbox"
                            checked={f.active}
                            onChange={(e) =>
                                setF({ ...f, active: e.target.checked })
                            }
                        />{" "}
                        Active
                    </label>
                    <div className="inline">
                        <button type="submit">Create Rule</button>
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
