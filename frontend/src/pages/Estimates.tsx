import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { Estimate, Shipment } from "../types";
import { dt, money } from "../lib/format";
import Modal from "../components/Modal";

export default function Estimates() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [shipmentId, setShipmentId] = useState("");
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [selected, setSelected] = useState<Estimate | null>(null);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        estimateDate: new Date().toISOString().slice(0, 10),
        reportingCurrency: "",
        shippingCost: "0",
        insuranceCost: "0",
        requestKey: "",
    });
    useEffect(() => {
        api.shipments()
            .then(setShipments)
            .catch((e) => setErr(String(e)));
    }, []);
    const load = async (id: string) => {
        if (!id) {
            setEstimates([]);
            setSelected(null);
            return;
        }
        const es = await api.estimatesForShipment(id);
        setEstimates(es);
        setSelected(es[0] || null);
    };
    useEffect(() => {
        if (shipmentId) load(shipmentId).catch((e) => setErr(String(e)));
        else {
            setEstimates([]);
            setSelected(null);
        }
    }, [shipmentId]);
    const create = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            const res = await api.createEstimate({
                shipmentId,
                estimateDate: f.estimateDate,
                reportingCurrency: f.reportingCurrency || undefined,
                shippingCost: Number(f.shippingCost || 0),
                insuranceCost: Number(f.insuranceCost || 0),
                requestKey: f.requestKey || undefined,
            });
            setOpen(false);
            setSelected(res);
            await load(shipmentId);
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    const cur = shipments.find((s) => s.shipmentId === shipmentId);
    return (
        <div>
            <h1>Landed Cost Estimates</h1>
            {err && <div className="error">{err}</div>}
            <div className="card">
                <label>
                    Select Shipment
                    <select
                        value={shipmentId}
                        onChange={(e) => setShipmentId(e.target.value)}
                    >
                        <option value="">Choose a shipment</option>
                        {shipments.map((s) => (
                            <option key={s.shipmentId} value={s.shipmentId}>
                                {s.trackingNumber} · Order {s.orderNumber} →{" "}
                                {s.destinationCode} ({s.carrier})
                            </option>
                        ))}
                    </select>
                </label>
                {cur && (
                    <p className="muted" style={{ marginTop: 8 }}>
                        Order {cur.orderNumber} · Destination:{" "}
                        {cur.destinationName} ({cur.destinationCode}) · Shipment
                        items: {cur.items.length}
                    </p>
                )}
                {shipmentId && (
                    <div style={{ marginTop: 10 }}>
                        <button onClick={() => setOpen(true)}>
                            Calculate Landed Cost
                        </button>
                    </div>
                )}
            </div>

            {shipmentId && estimates.length > 0 && (
                <div className="card">
                    <h3>Estimate Versions</h3>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Version</th>
                                    <th>Estimate Date</th>
                                    <th>Destination Landed Cost</th>
                                    <th>Reporting Landed Cost</th>
                                    <th>Supersedes</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {estimates.map((e) => (
                                    <tr
                                        key={e.estimateId}
                                        className={
                                            selected?.estimateId ===
                                            e.estimateId
                                                ? "sel"
                                                : ""
                                        }
                                    >
                                        <td>v{e.estimateVersion}</td>
                                        <td>{e.estimateDate}</td>
                                        <td>
                                            {money(
                                                e.destinationLandedCost,
                                                e.destinationCurrency,
                                            )}
                                        </td>
                                        <td>
                                            {money(
                                                e.reportingLandedCost,
                                                e.reportingCurrency,
                                            )}
                                        </td>
                                        <td>
                                            {e.previousEstimateId ? "Yes" : "-"}
                                        </td>
                                        <td>
                                            <button
                                                className="secondary"
                                                onClick={() => setSelected(e)}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {shipmentId && estimates.length === 0 && (
                <div className="card muted" style={{ textAlign: "center" }}>
                    No estimates yet for this shipment. Click "Calculate Landed
                    Cost" to create one.
                </div>
            )}

            {selected && (
                <div className="card">
                    <h3>Estimate Detail (v{selected.estimateVersion})</h3>
                    <div className="grid three">
                        <div>
                            <strong>Product Value:</strong>
                            <br />
                            {money(
                                selected.productValue,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Shipping Cost:</strong>
                            <br />
                            {money(
                                selected.shippingCost,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Insurance Cost:</strong>
                            <br />
                            {money(
                                selected.insuranceCost,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Duty Amount:</strong>
                            <br />
                            {money(
                                selected.dutyAmount,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Tax Amount:</strong>
                            <br />
                            {money(
                                selected.taxAmount,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Handling Fee:</strong>
                            <br />
                            {money(
                                selected.handlingFeeAmount,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Destination Landed Cost:</strong>
                            <br />
                            {money(
                                selected.destinationLandedCost,
                                selected.destinationCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Reporting Landed Cost:</strong>
                            <br />
                            {money(
                                selected.reportingLandedCost,
                                selected.reportingCurrency,
                            )}
                        </div>
                        <div>
                            <strong>Calculation Version:</strong>
                            <br />
                            {selected.calculationVersion}
                        </div>
                        <div>
                            <strong>Estimate Date:</strong>
                            <br />
                            {selected.estimateDate}
                        </div>
                        <div>
                            <strong>Estimated At:</strong>
                            <br />
                            {dt(selected.estimatedAt)}
                        </div>
                        <div>
                            <strong>Request Key:</strong>
                            <br />
                            {selected.requestKey || "-"}
                        </div>
                    </div>
                    <h4>Cost Components</h4>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Component Code</th>
                                    <th>Amount</th>
                                    <th>Currency</th>
                                    <th>Calculation Basis</th>
                                    <th>Applied Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selected.components.map((c) => (
                                    <tr key={c.componentId}>
                                        <td>{c.componentCode}</td>
                                        <td>
                                            {money(c.amount, c.currencyCode)}
                                        </td>
                                        <td>{c.currencyCode}</td>
                                        <td>{c.calculationBasis ?? "-"}</td>
                                        <td>{c.appliedRate ?? "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <details>
                        <summary>Rule Snapshot (JSON)</summary>
                        <pre>{selected.ruleSnapshot || "-"}</pre>
                    </details>
                    <details>
                        <summary>FX Snapshot (JSON)</summary>
                        <pre>{selected.fxSnapshot || "-"}</pre>
                    </details>
                </div>
            )}

            <Modal
                open={open}
                title="Calculate Landed Cost"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={create}>
                    <p className="muted">
                        Creates a new landed cost estimate for the selected
                        shipment (new version, linked to previous if any).
                    </p>
                    <label>
                        Estimate Date
                        <input
                            type="date"
                            value={f.estimateDate}
                            onChange={(e) =>
                                setF({ ...f, estimateDate: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Reporting Currency (optional, defaults to destination
                        currency)
                        <input
                            value={f.reportingCurrency}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    reportingCurrency:
                                        e.target.value.toUpperCase(),
                                })
                            }
                            maxLength={3}
                            placeholder="e.g. USD"
                        />
                    </label>
                    <label>
                        Shipping Cost (in order currency)
                        <input
                            type="number"
                            step="0.01"
                            value={f.shippingCost}
                            onChange={(e) =>
                                setF({ ...f, shippingCost: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Insurance Cost (in order currency)
                        <input
                            type="number"
                            step="0.01"
                            value={f.insuranceCost}
                            onChange={(e) =>
                                setF({ ...f, insuranceCost: e.target.value })
                            }
                        />
                    </label>
                    <label>
                        Request Key (optional, for idempotency)
                        <input
                            value={f.requestKey}
                            onChange={(e) =>
                                setF({ ...f, requestKey: e.target.value })
                            }
                            placeholder="Unique key to avoid duplicates"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Calculate Landed Cost</button>
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
