import { useState, type FormEvent } from "react";
import { setAuth } from "../lib/auth";
export default function Login({ onLogin }: { onLogin: () => void }) {
    const [user, setUser] = useState("admin");
    const [pass, setPass] = useState("admin123");
    const [err, setErr] = useState("");
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setErr("");
        setAuth(user, pass);
        try {
            const res = await fetch("/api/customers", {
                headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
            });
            if (res.status === 401) {
                setErr("Invalid username or password");
                return;
            }
            onLogin();
        } catch (ex: any) {
            setErr(ex.message || "Login failed");
        }
    };
    return (
        <div className="login-wrap">
            <form className="login card" onSubmit={submit}>
                <h1>CrossTrade</h1>
                <p className="muted">Sign in to continue</p>
                {err && <div className="error">{err}</div>}
                <label>
                    Username
                    <input
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        autoFocus
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                    />
                </label>
                <button type="submit">Sign in</button>
                <p className="muted" style={{ fontSize: 12 }}>
                    Default: admin / admin123
                </p>
            </form>
        </div>
    );
}
