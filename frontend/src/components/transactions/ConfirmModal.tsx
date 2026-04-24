"use client";

import { Dialog } from "@base-ui/react/dialog";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transactionLabel: string;
}

export function ConfirmModal({ open, onClose, onConfirm, transactionLabel }: ConfirmModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fern-modal-backdrop" />
        <Dialog.Popup className="fern-modal-popup">
          <Dialog.Title className="fern-modal-title">Delete transaction?</Dialog.Title>
          <Dialog.Description className="fern-modal-desc">
            <strong>{transactionLabel}</strong> will be permanently deleted. This cannot be undone.
          </Dialog.Description>
          <div className="fern-modal-footer">
            <button
              className="fern-sheet-btn secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="fern-sheet-btn danger"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
