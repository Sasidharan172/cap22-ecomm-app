import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { ExchangeRate } from "../types";
import Modal from "../components/Modal";
export default function ExchangeRates() {
    const [items, setItems] = useState<ExchangeRate[]>([]);
    const [open, setOpen] = useState(false);
    const [err, setErr] = useState("");
    const [f, setF] = useState({
        baseCurrency: "USD",
        targetCurrency: "EUR",
        exchangeRate: "",
        effectiveDate: new Date().toISOString().slice(0, 10),
        source: "manual",
    });
    const load = async () => setItems(await api.exchangeRates());
    useEffect(() => {
        load().catch((e) => setErr(String(e)));
    }, []);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        try {
            await api.createExchangeRate({
                ...f,
                exchangeRate: Number(f.exchangeRate),
            });
            setOpen(false);
            setF({ ...f, exchangeRate: "" });
            await load();
        } catch (ex: any) {
            setErr(ex.message);
        }
    };
    return (
        <div>
            <div className="page-head">
                <h1>Exchange Rates</h1>
                <button onClick={() => setOpen(true)}>
                    + New Exchange Rate
                </button>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Base Currency</th>
                            <th>Target Currency</th>
                            <th>Exchange Rate</th>
                            <th>Effective Date</th>
                            <th>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((r) => (
                            <tr key={r.exchangeRateId}>
                                <td>{r.baseCurrency}</td>
                                <td>{r.targetCurrency}</td>
                                <td>{r.exchangeRate}</td>
                                <td>{r.effectiveDate}</td>
                                <td>{r.source}</td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={5} className="muted">
                                    No exchange rates found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Modal
                open={open}
                title="Create Exchange Rate"
                onClose={() => setOpen(false)}
            >
                <form className="form" onSubmit={submit}>
                    <label>
                        Base Currency (ISO 3)
                        <input
                            value={f.baseCurrency}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    baseCurrency: e.target.value.toUpperCase(),
                                })
                            }
                            maxLength={3}
                            required
                            placeholder="USD"
                        />
                    </label>
                    <label>
                        Target Currency (ISO 3)
                        <input
                            value={f.targetCurrency}
                            onChange={(e) =>
                                setF({
                                    ...f,
                                    targetCurrency:
                                        e.target.value.toUpperCase(),
                                })
                            }
                            maxLength={3}
                            required
                            placeholder="EUR"
                        />
                    </label>
                    <label>
                        Exchange Rate
                        <input
                            type="number"
                            step="0.00000001"
                            value={f.exchangeRate}
                            onChange={(e) =>
                                setF({ ...f, exchangeRate: e.target.value })
                            }
                            required
                            placeholder="e.g. 0.92"
                        />
                    </label>
                    <label>
                        Effective Date
                        <input
                            type="date"
                            value={f.effectiveDate}
                            onChange={(e) =>
                                setF({ ...f, effectiveDate: e.target.value })
                            }
                            required
                        />
                    </label>
                    <label>
                        Source
                        <input
                            value={f.source}
                            onChange={(e) =>
                                setF({ ...f, source: e.target.value })
                            }
                            required
                            placeholder="e.g. manual, ECB"
                        />
                    </label>
                    <div className="inline">
                        <button type="submit">Create Exchange Rate</button>
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
