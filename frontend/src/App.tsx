import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Destinations from "./pages/Destinations";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Shipments from "./pages/Shipments";
import Estimates from "./pages/Estimates";
import Rules from "./pages/Rules";
import ExchangeRates from "./pages/ExchangeRates";
import DocumentsEvents from "./pages/DocumentsEvents";
import ExceptionsPage from "./pages/ExceptionsPage";
import Login from "./pages/Login";
import { getAuth } from "./lib/auth";

export default function App() {
    const [authed, setAuthed] = useState(!!getAuth());
    useEffect(() => {
        const onLogout = () => setAuthed(false);
        window.addEventListener("auth:logout", onLogout);
        return () => window.removeEventListener("auth:logout", onLogout);
    }, []);
    if (!authed) return <Login onLogin={() => setAuthed(true)} />;
    return (
        <Routes>
            <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="destinations" element={<Destinations />} />
                <Route path="products" element={<Products />} />
                <Route path="orders" element={<Orders />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="estimates" element={<Estimates />} />
                <Route path="rules" element={<Rules />} />
                <Route path="exchange-rates" element={<ExchangeRates />} />
                <Route path="documents" element={<DocumentsEvents />} />
                <Route path="exceptions" element={<ExceptionsPage />} />
            </Route>
        </Routes>
    );
}
