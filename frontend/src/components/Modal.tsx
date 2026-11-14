import React from "react";
export default function Modal({
    open,
    title,
    onClose,
    children,
}: {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    if (!open) return null;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="secondary" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}
