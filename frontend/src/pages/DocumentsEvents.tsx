import { useEffect, useState } from "react";
import { api } from "../api";
import type {
    CarrierEvent,
    DocumentType,
    Shipment,
    ShipmentDocument,
} from "../types";
import { dt } from "../lib/format";
import Modal from "../components/Modal";

export default function DocumentsEvents() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [shipmentId, setShipmentId] = useState("");
    const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
    const [docs, setDocs] = useState<ShipmentDocument[]>([]);
    const [events, setEvents] = useState<CarrierEvent[]>([]);
    const [err, setErr] = useState("");
    const [openType, setOpenType] = useState(false);
    const [openDoc, setOpenDoc] = useState(false);
    const [openEvt, setOpenEvt] = useState(false);
    const [dtf, setDtf] = useState({ code: "", name: "" });
    const [df, setDf] = useState({
        documentTypeId: "",
        verificationStatus: "PENDING",
    });
    const [ef, setEf] = useState({
        externalEventId: "",
        rawEventCode: "",
        normalizedEventType: "IN_TRANSIT",
        occurredAt: new Date().toISOString().slice(0, 16),
        isEffective: true,
        rawPayload: "{}",
    });
    const loadBase = async () => {
        const [s, t] = await Promise.all([
            api.shipments(),
            api.documentTypes(),
        ]);
        setShipments(s);
        setDocTypes(t);
    };
    const loadShip = async (id: string) => {
        if (!id) {
            setDocs([]);
            setEvents([]);
            return;
        }
        const [d, e] = await Promise.all([
            api.shipmentDocuments(id),
            api.carrierEvents(id),
        ]);
        setDocs(d);
        setEvents(e);
    };
    useEffect(() => {
        loadBase().catch((e) => setErr(String(e)));
    }, []);
    useEffect(() => {
        if (shipmentId) loadShip(shipmentId).catch((e) => setErr(String(e)));
        else {
            setDocs([]);
            setEvents([]);
        }
    }, [shipmentId]);
    return (
        <div>
            <h1>Documents & Carrier Events</h1>
            {err && <div className="error">{err}</div>}

            <div className="card">
                <div className="page-head">
                    <h3 style={{ margin: 0 }}>Document Types</h3>
                    <button onClick={() => setOpenType(true)}>
                        + New Document Type
                    </button>
                </div>
                <p className="muted">
                    All available document types (used when attaching documents
                    to shipments):
                </p>
                <div className="chips" style={{ marginTop: 8 }}>
                    {docTypes.map((t) => (
                        <span key={t.documentTypeId} className="chip">
                            <strong>{t.code}</strong> — {t.name}
                        </span>
                    ))}
                    {docTypes.length === 0 && (
                        <span className="muted">
                            No document types defined yet.
                        </span>
                    )}
                </div>
            </div>

            <div className="card">
                <label>
                    Shipment
                    <select
                        value={shipmentId}
                        onChange={(e) => setShipmentId(e.target.value)}
                    >
                        <option value="">
                            Select a shipment to view/add documents & events
                        </option>
                        {shipments.map((s) => (
                            <option key={s.shipmentId} value={s.shipmentId}>
                                {s.trackingNumber} · {s.orderNumber} (
                                {s.carrier})
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {shipmentId && (
                <div className="grid two">
                    <div className="card">
                        <div className="page-head">
                            <h3 style={{ margin: 0 }}>Shipment Documents</h3>
                            <button onClick={() => setOpenDoc(true)}>
                                + Add Document
                            </button>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Document Type</th>
                                        <th>Verification Status</th>
                                        <th>Received At</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docs.map((d) => (
                                        <tr key={d.shipmentDocumentId}>
                                            <td>
                                                {d.documentTypeCode} -{" "}
                                                {d.documentTypeName}
                                            </td>
                                            <td>{d.verificationStatus}</td>
                                            <td>{dt(d.receivedAt)}</td>
                                        </tr>
                                    ))}
                                    {docs.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="muted">
                                                No documents for this shipment
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="card">
                        <div className="page-head">
                            <h3 style={{ margin: 0 }}>Carrier Events</h3>
                            <button onClick={() => setOpenEvt(true)}>
                                + Add Event
                            </button>
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Normalized Type</th>
                                        <th>Raw Code</th>
                                        <th>Occurred At</th>
                                        <th>Duplicate</th>
                                        <th>Effective</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((ev) => (
                                        <tr key={ev.carrierEventId}>
                                            <td>{ev.normalizedEventType}</td>
                                            <td>{ev.rawEventCode}</td>
                                            <td>{dt(ev.occurredAt)}</td>
                                            <td>{String(ev.isDuplicate)}</td>
                                            <td>{String(ev.isEffective)}</td>
                                        </tr>
                                    ))}
                                    {events.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="muted">
                                                No carrier events for this
                                                shipment
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <Modal
                open={openType}
                title="Create Document Type"
                onClose={() => setOpenType(false)}
            >
                <form
                    className="form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            await api.createDocumentType(dtf);
                            setDtf({ code: "", name: "" });
                            setOpenType(false);
                            await loadBase();
                        } catch (ex: any) {
                            setErr(ex.message);
                        }
                    }}
                >
                    <label>
                        Code
                        <input
                            value={dtf.code}
                            onChange={(e) =>
                                setDtf({ ...dtf, code: e.target.value })
                            }
                            required
                            placeholder="e.g. COMMERCIAL_INVOICE"
                        />
                    </label>
                    <label>
                        Name
                        <input
                            value={dtf.name}
                            onChange={(e) =>
                                setDtf({ ...dtf, name: e.target.value })
                            }
                            required
                            placeholder="e.g. Commercial Invoice"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Type</button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setOpenType(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={openDoc}
                title="Add Shipment Document"
                onClose={() => setOpenDoc(false)}
            >
                <form
                    className="form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            await api.addShipmentDocument(shipmentId, df);
                            setOpenDoc(false);
                            await loadShip(shipmentId);
                        } catch (ex: any) {
                            setErr(ex.message);
                        }
                    }}
                >
                    <label>
                        Document Type
                        <select
                            value={df.documentTypeId}
                            onChange={(e) =>
                                setDf({ ...df, documentTypeId: e.target.value })
                            }
                            required
                        >
                            <option value="">Select document type</option>
                            {docTypes.map((t) => (
                                <option
                                    key={t.documentTypeId}
                                    value={t.documentTypeId}
                                >
                                    {t.code} - {t.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Verification Status
                        <select
                            value={df.verificationStatus}
                            onChange={(e) =>
                                setDf({
                                    ...df,
                                    verificationStatus: e.target.value,
                                })
                            }
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="VERIFIED">VERIFIED</option>
                            <option value="REJECTED">REJECTED</option>
                        </select>
                    </label>
                    <div className="inline">
                        <button type="submit">Add Document</button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setOpenDoc(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={openEvt}
                title="Add Carrier Event"
                onClose={() => setOpenEvt(false)}
            >
                <form
                    className="form"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                            await api.addCarrierEvent(shipmentId, {
                                ...ef,
                                occurredAt: new Date(
                                    ef.occurredAt,
                                ).toISOString(),
                            });
                            setOpenEvt(false);
                            await loadShip(shipmentId);
                        } catch (ex: any) {
                            setErr(ex.message);
                        }
                    }}
                >
                    <label>
                        External Event ID
                        <input
                            value={ef.externalEventId}
                            onChange={(e) =>
                                setEf({
                                    ...ef,
                                    externalEventId: e.target.value,
                                })
                            }
                            placeholder="Optional external id"
                        />
                    </label>
                    <label>
                        Raw Event Code
                        <input
                            value={ef.rawEventCode}
                            onChange={(e) =>
                                setEf({ ...ef, rawEventCode: e.target.value })
                            }
                            required
                            placeholder="Carrier raw code"
                        />
                    </label>
                    <label>
                        Normalized Event Type
                        <input
                            value={ef.normalizedEventType}
                            onChange={(e) =>
                                setEf({
                                    ...ef,
                                    normalizedEventType: e.target.value,
                                })
                            }
                            required
                            placeholder="e.g. IN_TRANSIT, DELIVERED"
                        />
                    </label>
                    <label>
                        Occurred At
                        <input
                            type="datetime-local"
                            value={ef.occurredAt}
                            onChange={(e) =>
                                setEf({ ...ef, occurredAt: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label className="row">
                        <input
                            type="checkbox"
                            checked={ef.isEffective}
                            onChange={(e) =>
                                setEf({ ...ef, isEffective: e.target.checked })
                            }
                        />{" "}
                        Mark as effective
                    </label>
                    <label>
                        Raw Payload (JSON)
                        <textarea
                            value={ef.rawPayload}
                            onChange={(e) =>
                                setEf({ ...ef, rawPayload: e.target.value })
                            }
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Add Event</button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setOpenEvt(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
