'use client';

import { useEffect, useRef, useState } from 'react';

export default function EmployeeModal({
    mode,
    initialName,
    onConfirm,
    onRemove,
    onClose,
}: {
    mode: 'add' | 'edit';
    initialName: string;
    onConfirm: (name: string) => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const [name, setName] = useState(initialName);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') onConfirm(name);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [name, onClose, onConfirm]);

    return (
        <div
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal">
                <h2>{mode === 'edit' ? '✏️ Edit / Remove Employee' : '👤 Add New Employee'}</h2>
                <div className="form-group">
                    <label>Full Name</label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        placeholder="e.g. Jane Smith"
                        autoComplete="off"
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className="btn-row">
                    {mode === 'edit' && (
                        <button
                            className="btn btn-danger"
                            style={{ marginRight: 'auto' }}
                            onClick={onRemove}
                        >
                            Remove Employee
                        </button>
                    )}
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={() => onConfirm(name)}>
                        {mode === 'edit' ? 'Save Changes' : 'Add Employee'}
                    </button>
                </div>
            </div>
        </div>
    );
}
