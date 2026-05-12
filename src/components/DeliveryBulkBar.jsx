import { useState } from "react";

export default function DeliveryBulkBar({
  selectedCount,
  tiers,
  files,
  onMoveToTier,
  onAddAddon,
  onSendSelected,
  onDeleteSelected,
  onClearSelection,
}) {
  const [moveTo, setMoveTo] = useState("");
  const [addonId, setAddonId] = useState("");

  if (!selectedCount) return null;

  return (
    <div className="delivery-bulkbar" role="region" aria-label="Bulk actions">
      <div className="delivery-bulkbar__count">
        <strong>{selectedCount}</strong> selected
        <button
          className="delivery-bulkbar__clear"
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
        >
          ✕
        </button>
      </div>

      <div className="delivery-bulkbar__group">
        <label className="delivery-bulkbar__field">
          <span>Move to tier</span>
          <select
            value={moveTo}
            onChange={(event) => setMoveTo(event.target.value)}
            disabled={!tiers.length}
          >
            <option value="">Choose tier…</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button-secondary button-compact"
          type="button"
          disabled={!moveTo}
          onClick={() => {
            if (!moveTo) return;
            onMoveToTier(moveTo);
            setMoveTo("");
          }}
        >
          Move
        </button>
      </div>

      <div className="delivery-bulkbar__group">
        <label className="delivery-bulkbar__field">
          <span>Add add-on</span>
          <select
            value={addonId}
            onChange={(event) => setAddonId(event.target.value)}
            disabled={!files.length}
          >
            <option value="">Choose file…</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.originalFilename}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button-secondary button-compact"
          type="button"
          disabled={!addonId}
          onClick={() => {
            if (!addonId) return;
            onAddAddon(addonId);
            setAddonId("");
          }}
        >
          Add
        </button>
      </div>

      <div className="delivery-bulkbar__actions">
        <button className="button-secondary button-compact" type="button" onClick={onSendSelected}>
          Send email
        </button>
        <button className="button-danger button-compact" type="button" onClick={onDeleteSelected}>
          Delete
        </button>
      </div>
    </div>
  );
}
