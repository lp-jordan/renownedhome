import { useEffect, useRef, useState } from "react";

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 20h4l10-10-4-4L4 16v4Zm12.8-12.8 1.2-1.2a1.7 1.7 0 0 1 2.4 0l1.6 1.6a1.7 1.7 0 0 1 0 2.4l-1.2 1.2-4-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 4h6l1 2h4v2H4V6h4l1-2Zm1 6h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Zm1 10h8a2 2 0 0 0 2-2V8H6v10a2 2 0 0 0 2 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM6 6h6v2H8v8h8v-4h2v6H6V6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GrabIcon() {
  return (
    <svg viewBox="0 0 12 18" aria-hidden="true">
      {[3, 9].map((x) =>
        [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" />)
      )}
    </svg>
  );
}

function sortFilesByRecent(files) {
  return [...files].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.uploadedAt || 0).getTime() || 0;
    const bTime = new Date(b.createdAt || b.uploadedAt || 0).getTime() || 0;
    if (aTime !== bTime) return bTime - aTime;
    return String(a.originalFilename || "").localeCompare(String(b.originalFilename || ""));
  });
}

function BackerRow({
  backer,
  tiers,
  isSelected,
  isEditing,
  files,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  onAddAddon,
  onRemoveAddon,
  onDragStart,
  onDragEnd,
  draftEmail,
  draftTierId,
  setDraftEmail,
  setDraftTierId,
  canDrag,
  selectedCount,
}) {
  const [addonPickId, setAddonPickId] = useState("");
  const currentTier = tiers.find((tier) => tier.id === backer.tierId);
  const tierFileIds = new Set(currentTier?.fileIds || []);
  const addonIds = new Set(backer.addonFileIds || []);
  const availableAddonFiles = files.filter((file) => !tierFileIds.has(file.id) && !addonIds.has(file.id));
  const effectiveAddonPick = addonPickId || availableAddonFiles[0]?.id || "";

  return (
    <article
      className={`delivery-backer-row${isSelected ? " is-selected" : ""}`}
      onClick={(event) => {
        if (isEditing) return;
        onSelect(event);
      }}
    >
      <div className="delivery-backer-row__lead">
        <button
          className="delivery-backer-row__grab"
          type="button"
          disabled={!canDrag}
          draggable={canDrag}
          onMouseDown={(event) => event.stopPropagation()}
          onDragStart={(event) => onDragStart(event)}
          onDragEnd={onDragEnd}
          aria-label="Drag to another tier"
          title={
            canDrag
              ? isSelected && selectedCount > 1
                ? `Drag ${selectedCount} selected`
                : "Drag to another tier"
              : "Add another tier to move this backer"
          }
        >
          <GrabIcon />
        </button>
      </div>

      {isEditing ? (
        <div className="delivery-backer-row__edit">
          <input
            value={draftEmail}
            onChange={(event) => setDraftEmail(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Backer email"
          />
          <select
            value={draftTierId}
            onChange={(event) => setDraftTierId(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Backer tier"
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>

          <div className="delivery-backer-row__addons" onClick={(event) => event.stopPropagation()}>
            <span className="delivery-backer-row__addons-label">Add-ons</span>
            {addonIds.size === 0 ? (
              <span className="delivery-backer-row__addons-empty">None</span>
            ) : (
              [...addonIds].map((fileId) => {
                const file = files.find((entry) => entry.id === fileId);
                if (!file) return null;
                return (
                  <span key={fileId} className="delivery-backer-row__addon-tag">
                    <span className="delivery-backer-row__addon-name">{file.originalFilename}</span>
                    <button
                      className="delivery-backer-row__addon-remove"
                      type="button"
                      aria-label={`Remove ${file.originalFilename}`}
                      onClick={() => onRemoveAddon(fileId)}
                    >
                      ×
                    </button>
                  </span>
                );
              })
            )}
            {availableAddonFiles.length > 0 ? (
              <div className="delivery-backer-row__addon-add">
                <select
                  value={effectiveAddonPick}
                  onChange={(event) => setAddonPickId(event.target.value)}
                  aria-label="File to add as add-on"
                >
                  {availableAddonFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.originalFilename}
                    </option>
                  ))}
                </select>
                <button
                  className="button-secondary button-compact"
                  type="button"
                  onClick={() => {
                    if (effectiveAddonPick) onAddAddon(effectiveAddonPick);
                    setAddonPickId("");
                  }}
                >
                  Add
                </button>
              </div>
            ) : null}
          </div>

          <div className="delivery-backer-row__edit-actions">
            <button
              className="button-primary button-compact"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSaveEdit();
              }}
            >
              Save
            </button>
            <button
              className="button-secondary button-compact"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCancelEdit();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="delivery-backer-row__content">
            <strong>{backer.email}</strong>
            {backer.lastEmailedAt ? (
              <span className="delivery-backer-sent">Sent</span>
            ) : (
              <span className="delivery-backer-unsent">Unsent</span>
            )}
          </div>
          <div className="delivery-backer-row__actions">
            <button
              className="delivery-icon-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit();
              }}
              aria-label={`Edit ${backer.email}`}
            >
              <PencilIcon />
            </button>
            <button
              className="delivery-icon-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete();
              }}
              aria-label={`Delete ${backer.email}`}
            >
              <TrashIcon />
            </button>
            <a
              className="delivery-icon-button"
              href={`/a/${backer.accessToken}`}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label={`Open page for ${backer.email}`}
            >
              <ExternalIcon />
            </a>
          </div>
        </>
      )}
    </article>
  );
}

function TierCard({
  tier,
  index,
  totalTiers,
  detail,
  files,
  sortedFiles,
  selectedBackerIds,
  editingBackerId,
  backerDraft,
  draggedBackerIds,
  dragOverTierId,
  importText,
  importStatus,
  onTierFieldChange,
  onToggleFile,
  onRemoveTier,
  onImportEmails,
  onImportTextChange,
  onSelectBacker,
  onStartEditBacker,
  onCancelEditBacker,
  onSaveBacker,
  onSetBackerDraft,
  onRequestDeleteBacker,
  onAddAddon,
  onRemoveAddon,
  onPreviewEmail,
  onDropOnTier,
  onDragOverTier,
  onDragLeaveTier,
  onBackerDragStart,
  onBackerDragEnd,
}) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const customizeRef = useRef(null);

  useEffect(() => {
    if (tier.messageOverride || tier.additionalLinkUrl || tier.additionalLinkLabel) {
      setShowCustomize(true);
    }
  }, [tier.messageOverride, tier.additionalLinkUrl, tier.additionalLinkLabel]);

  const previewBacker = detail.backers.find((backer) => backer.tierId === tier.id);
  const tierBackers = detail.backers.filter((backer) => backer.tierId === tier.id);
  const moveTargets = (detail.tiers || []).filter((entry) => entry.id !== tier.id);
  const isDropTarget = dragOverTierId === tier.id;
  const canRemove = totalTiers > 1 && (tier.backerCount || 0) === 0;

  return (
    <section
      className={`delivery-tier-card${isDropTarget ? " is-drop" : ""}`}
      onDragOver={(event) => {
        if (draggedBackerIds.length) onDragOverTier(event, tier);
      }}
      onDragLeave={() => onDragLeaveTier(tier)}
      onDrop={(event) => onDropOnTier(event, tier)}
    >
      <header className="delivery-tier-card__header">
        <input
          className="delivery-tier-card__name"
          value={tier.name}
          onChange={(event) => onTierFieldChange(index, "name", event.target.value)}
          aria-label={`Tier ${index + 1} name`}
        />
        <span className="delivery-tier-card__count">
          {tierBackers.length} backer{tierBackers.length === 1 ? "" : "s"}
        </span>
        <button
          className="button-secondary button-compact"
          type="button"
          onClick={() => onRemoveTier(index)}
          disabled={!canRemove}
          title={canRemove ? "Remove tier" : "Move backers out before removing"}
        >
          Remove tier
        </button>
      </header>

      <details
        className="delivery-tier-card__customize"
        open={showCustomize}
        onToggle={(event) => setShowCustomize(event.currentTarget.open)}
        ref={customizeRef}
      >
        <summary>Customize message &amp; link</summary>
        <div className="delivery-tier-card__customize-body">
          <label>
            <span>Tier-specific message</span>
            <textarea
              rows={3}
              value={tier.messageOverride}
              onChange={(event) => onTierFieldChange(index, "messageOverride", event.target.value)}
              placeholder={detail.project.shortMessage || "Leave blank to use the campaign default."}
            />
          </label>
          <div className="delivery-tier-card__link-row">
            <label>
              <span>Extra link label</span>
              <input
                value={tier.additionalLinkLabel || ""}
                onChange={(event) =>
                  onTierFieldChange(index, "additionalLinkLabel", event.target.value)
                }
                placeholder="Leave a Letter"
              />
            </label>
            <label>
              <span>Extra link URL</span>
              <input
                value={tier.additionalLinkUrl || ""}
                onChange={(event) =>
                  onTierFieldChange(index, "additionalLinkUrl", event.target.value)
                }
                placeholder="https://example.com"
              />
            </label>
          </div>
        </div>
      </details>

      <div className="delivery-tier-card__files">
        <span className="delivery-tier-card__section-label">Files for this tier</span>
        {sortedFiles.length ? (
          <div className="delivery-tier-card__file-grid">
            {sortedFiles.map((file) => (
              <label key={file.id} className="delivery-tier-card__file-toggle">
                <input
                  type="checkbox"
                  checked={tier.fileIds.includes(file.id)}
                  onChange={() => onToggleFile(index, file.id)}
                />
                <span>{file.originalFilename}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="status-line">Upload PDFs in the Assets section first.</p>
        )}
      </div>

      <div className="delivery-tier-card__backers">
        <div className="delivery-tier-card__section-head">
          <span className="delivery-tier-card__section-label">Backers</span>
          <div className="delivery-tier-card__section-actions">
            <button
              className="delivery-tier-card__link-button"
              type="button"
              onClick={() => setShowImport((current) => !current)}
            >
              {showImport ? "Hide import" : "Import emails"}
            </button>
            {previewBacker ? (
              <>
                <a
                  className="delivery-tier-card__link-button"
                  href={`/a/${previewBacker.accessToken}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview page
                </a>
                <button
                  className="delivery-tier-card__link-button"
                  type="button"
                  onClick={() => onPreviewEmail(tier, previewBacker)}
                >
                  Preview email
                </button>
              </>
            ) : null}
          </div>
        </div>

        {showImport ? (
          <div className="delivery-tier-card__import">
            <textarea
              rows={4}
              value={importText}
              onChange={(event) => onImportTextChange(tier.id, event.target.value)}
              placeholder={"reader@example.com\ncollector@example.com"}
            />
            <div className="delivery-inline-actions">
              <button
                className="button-primary button-compact"
                type="button"
                onClick={() => onImportEmails(tier)}
              >
                Import into {tier.name || `Tier ${index + 1}`}
              </button>
            </div>
            {importStatus ? <p className="status-line">{importStatus}</p> : null}
          </div>
        ) : null}

        {tierBackers.length ? (
          <div className="delivery-tier-card__backer-list">
            {tierBackers.map((backer) => {
              const isSelected = selectedBackerIds.includes(backer.id);
              const isEditing = editingBackerId === backer.id;
              return (
                <BackerRow
                  key={backer.id}
                  backer={backer}
                  tiers={detail.tiers}
                  files={files}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  canDrag={moveTargets.length > 0}
                  selectedCount={selectedBackerIds.length}
                  draftEmail={backerDraft.email}
                  draftTierId={backerDraft.tierId}
                  setDraftEmail={(value) =>
                    onSetBackerDraft((current) => ({ ...current, email: value }))
                  }
                  setDraftTierId={(value) =>
                    onSetBackerDraft((current) => ({ ...current, tierId: value }))
                  }
                  onSelect={(event) => onSelectBacker(backer.id, event)}
                  onStartEdit={() => onStartEditBacker(backer)}
                  onCancelEdit={onCancelEditBacker}
                  onSaveEdit={() => onSaveBacker(backer.id)}
                  onRequestDelete={() => onRequestDeleteBacker(backer)}
                  onAddAddon={(fileId) => onAddAddon(backer.id, fileId)}
                  onRemoveAddon={(fileId) => onRemoveAddon(backer.id, fileId)}
                  onDragStart={(event) => onBackerDragStart(backer, event)}
                  onDragEnd={onBackerDragEnd}
                />
              );
            })}
          </div>
        ) : (
          <p className="status-line">No backers in this tier yet. Drop emails above to add some.</p>
        )}
      </div>
    </section>
  );
}

export default function DeliveryAudience({
  detail,
  tiersDraft,
  files,
  selectedBackerIds,
  editingBackerId,
  backerDraft,
  draggedBackerIds,
  dragOverTierId,
  tierImportTexts,
  tierImportStatuses,
  onAddTier,
  onTierFieldChange,
  onToggleFile,
  onRemoveTier,
  onImportEmails,
  onImportTextChange,
  onSelectBacker,
  onStartEditBacker,
  onCancelEditBacker,
  onSaveBacker,
  onSetBackerDraft,
  onRequestDeleteBacker,
  onAddAddon,
  onRemoveAddon,
  onPreviewEmail,
  onDropOnTier,
  onDragOverTier,
  onDragLeaveTier,
  onBackerDragStart,
  onBackerDragEnd,
  listRef,
}) {
  const sortedFiles = sortFilesByRecent(files || []);

  return (
    <section className="delivery-audience" ref={listRef}>
      <div className="delivery-audience__head">
        <div>
          <h2>Audience</h2>
          <p className="status-line">
            Tier name, files, message, and backers all live together. Drag a backer between tiers to
            move them.
          </p>
        </div>
        <button className="button-secondary button-compact" type="button" onClick={onAddTier}>
          + Add tier
        </button>
      </div>

      <div className="delivery-audience__tiers">
        {tiersDraft.map((tier, index) => (
          <TierCard
            key={tier.id}
            tier={tier}
            index={index}
            totalTiers={tiersDraft.length}
            detail={detail}
            files={files}
            sortedFiles={sortedFiles}
            selectedBackerIds={selectedBackerIds}
            editingBackerId={editingBackerId}
            backerDraft={backerDraft}
            draggedBackerIds={draggedBackerIds}
            dragOverTierId={dragOverTierId}
            importText={tierImportTexts[tier.id] || ""}
            importStatus={tierImportStatuses[tier.id] || ""}
            onTierFieldChange={onTierFieldChange}
            onToggleFile={onToggleFile}
            onRemoveTier={onRemoveTier}
            onImportEmails={onImportEmails}
            onImportTextChange={onImportTextChange}
            onSelectBacker={onSelectBacker}
            onStartEditBacker={onStartEditBacker}
            onCancelEditBacker={onCancelEditBacker}
            onSaveBacker={onSaveBacker}
            onSetBackerDraft={onSetBackerDraft}
            onRequestDeleteBacker={onRequestDeleteBacker}
            onAddAddon={onAddAddon}
            onRemoveAddon={onRemoveAddon}
            onPreviewEmail={onPreviewEmail}
            onDropOnTier={onDropOnTier}
            onDragOverTier={onDragOverTier}
            onDragLeaveTier={onDragLeaveTier}
            onBackerDragStart={onBackerDragStart}
            onBackerDragEnd={onBackerDragEnd}
          />
        ))}
      </div>
    </section>
  );
}
