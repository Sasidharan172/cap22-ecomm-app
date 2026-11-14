import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Shipment, ShipmentException } from "../types";
import { dt } from "../lib/format";
import Modal from "../components/Modal";

export default function ExceptionsPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [items, setItems] = useState<ShipmentException[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        shipmentId: "",
        exceptionType: "DELAY",
        severity: "MEDIUM",
        status: "OPEN",
        summary: "",
    });
    const load = async () => {
        const [s, e] = await Promise.all([api.shipments(), api.exceptions()]);
        setShipments(s);
        setItems(e);
    };
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createException(f.shipmentId, {
                exceptionType: f.exceptionType,
                severity: f.severity,
                status: f.status,
                summary: f.summary,
            });
            setOpen(false);
            setF({ ...f, summary: "" });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Exceptions</h1>
                <button onClick={() => setOpen(true)}>+ New Exception</button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Shipment</th>
                            <th>Type</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Summary</th>
                            <th>Opened At</th>
                            <th>Resolved At</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((x) => (
                            <tr key={x.exceptionId}>
                                <td>
                                    {(() => {
                                        const s = shipments.find(
                                            (v) =>
                                                v.shipmentId === x.shipmentId,
                                        );
                                        return s
                                            ? `${s.trackingNumber} · ${s.orderNumber}`
                                            : "Shipment";
                                    })()}
                                </td>
                                <td>{x.exceptionType}</td>
                                <td>{x.severity}</td>
                                <td>{x.status}</td>
                                <td style={{ textAlign: "left" }}>
                                    {x.summary}
                                </td>
                                <td>{dt(x.openedAt)}</td>
                                <td>{dt(x.resolvedAt)}</td>
                                <td>
                                    {x.status !== "RESOLVED" && (
                                        <button
                                            className="secondary"
                                            onClick={async () => {
                                                await api.resolveException(
                                                    x.exceptionId,
                                                );
                                                await load();
                                            }}
                                        >
                                            Resolve
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={8} className="muted">
                                    No exceptions found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Exception"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Shipment
                        <select
                            value={f.shipmentId}
                            onChange={(e) =>
                                setF({ ...f, shipmentId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select shipment</option>
                            {shipments.map((s) => (
                                <option key={s.shipmentId} value={s.shipmentId}>
                                    {s.trackingNumber} ({s.orderNumber})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Exception Type
                        <input
                            value={f.exceptionType}
                            onChange={(e) =>
                                setF({ ...f, exceptionType: e.target.value })
                            }
                            required
                            placeholder="e.g. DELAY, DAMAGE"
                        />
                    </label>
                    <label>
                        Severity
                        <select
                            value={f.severity}
                            onChange={(e) =>
                                setF({ ...f, severity: e.target.value })
                            }
                        >
                            <option>LOW</option>
                            <option>MEDIUM</option>
                            <option>HIGH</option>
                        </select>
                    </label>
                    <label>
                        Status
                        <select
                            value={f.status}
                            onChange={(e) =>
                                setF({ ...f, status: e.target.value })
                            }
                        >
                            <option>OPEN</option>
                            <option>ACKNOWLEDGED</option>
                            <option>RESOLVED</option>
                        </select>
                    </label>
                    <label>
                        Summary
                        <textarea
                            value={f.summary}
                            onChange={(e) =>
                                setF({ ...f, summary: e.target.value })
                            }
                            required
                            placeholder="Describe the exception"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Exception</button>
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
