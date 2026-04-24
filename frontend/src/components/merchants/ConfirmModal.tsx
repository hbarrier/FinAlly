"use client";

import { Dialog } from "@base-ui/react/dialog";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  merchantName: string;
}

export function ConfirmModal({ open, onClose, onConfirm, merchantName }: ConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fern-modal-backdrop" />
        <Dialog.Popup className="fern-modal-popup">
          <Dialog.Title className="fern-modal-title">Delete merchant</Dialog.Title>
          <Dialog.Description className="fern-modal-desc">
            Delete <strong>{merchantName}</strong>? Existing transactions will lose their merchant
            reference. This cannot be undone.
          </Dialog.Description>
          <div className="fern-modal-footer">
            <button className="fern-sheet-btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="fern-sheet-btn danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
