import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { buildDeliveryEmail } from "../lib/resendEmail";
import DeliveryAssets from "./DeliveryAssets";
import DeliveryAudience from "./DeliveryAudience";
import DeliveryAnalytics from "./DeliveryAnalytics";
import DeliveryBulkBar from "./DeliveryBulkBar";
import DeliveryConfirmDialog from "./DeliveryConfirmDialog";
import DeliveryPdfDialog from "./DeliveryPdfDialog";
import DeliverySendDialog from "./DeliverySendDialog";

const AUTOSAVE_DELAY = 700;

function emptyProjectForm() {
  return {
    title: "",
    creatorName: "Renowned",
    slug: "",
    shortMessage: "",
    description: "",
  };
}

function createTierDraft(index = 0, fileIds = []) {
  return {
    id: `new-tier-${Date.now()}-${index}`,
    name: `Tier ${index + 1}`,
    messageOverride: "",
    additionalLinkLabel: "",
    additionalLinkUrl: "",
    fileIds,
    isNew: true,
    backerCount: 0,
  };
}

function fileRoute(fileId) {
  return `/api/delivery/files/${encodeURIComponent(fileId)}`;
}

function tierConfigPayload(tiersDraft) {
  return tiersDraft.map((tier, index) => ({
    id: tier.isNew ? undefined : tier.id,
    name: tier.name,
    messageOverride: tier.messageOverride,
    additionalLinkLabel: tier.additionalLinkLabel,
    additionalLinkUrl: tier.additionalLinkUrl,
    fileIds: tier.fileIds,
    sortOrder: index,
  }));
}

export default function DeliveryAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState("");
  const [activeTab, setActiveTab] = useState("setup");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [projectFormStatus, setProjectFormStatus] = useState("");

  const [configForm, setConfigForm] = useState(emptyProjectForm());
  const [tiersDraft, setTiersDraft] = useState([]);

  const [selectedBackerIds, setSelectedBackerIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState("");
  const [editingBackerId, setEditingBackerId] = useState("");
  const [backerDraft, setBackerDraft] = useState({ email: "", tierId: "" });
  const [draggedBackerIds, setDraggedBackerIds] = useState([]);
  const [dragOverTierId, setDragOverTierId] = useState("");
  const [tierImportTexts, setTierImportTexts] = useState({});
  const [tierImportStatuses, setTierImportStatuses] = useState({});

  const [saveStatus, setSaveStatus] = useState("");
  const [generalStatus, setGeneralStatus] = useState("");

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [pdfDialog, setPdfDialog] = useState(null);
  const [sendDialog, setSendDialog] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const audienceListRef = useRef(null);
  const bulkBarRef = useRef(null);
  const skipAutoSaveRef = useRef(true);
  const autoSaveTimerRef = useRef(null);
  const savedStatusTimerRef = useRef(null);
  const menuRef = useRef(null);

  const setTransientStatus = useCallback((text) => {
    setSaveStatus(text);
    clearTimeout(savedStatusTimerRef.current);
    savedStatusTimerRef.current = setTimeout(() => setSaveStatus(""), 2400);
  }, []);

  async function loadDashboard() {
    const [nextSummary, nextProjects] = await Promise.all([
      api.getDeliverySummary(),
      api.getDeliveryProjects(),
    ]);
    setSummary(nextSummary);
    setProjects(nextProjects.projects);
    return nextProjects.projects;
  }

  function syncFromDetail(nextDetail) {
    skipAutoSaveRef.current = true;
    setConfigForm({
      title: nextDetail.project.title || "",
      creatorName: nextDetail.project.creatorName || "",
      slug: nextDetail.project.slug || "",
      shortMessage: nextDetail.project.shortMessage || "",
      description: nextDetail.project.description || "",
    });
    setTiersDraft(
      (nextDetail.tiers || []).map((tier) => ({
        id: tier.id,
        name: tier.name || "",
        messageOverride: tier.messageOverride || "",
        additionalLinkLabel: tier.additionalLinkLabel || "",
        additionalLinkUrl: tier.additionalLinkUrl || "",
        fileIds: [...(tier.fileIds || [])],
        backerCount: tier.backerCount || 0,
      }))
    );
    setSelectedBackerIds([]);
    setSelectionAnchorId("");
    setEditingBackerId("");
    setBackerDraft({ email: "", tierId: nextDetail.tiers?.[0]?.id || "" });
    setTierImportTexts({});
    setTierImportStatuses({});
  }

  async function loadProjectDetail(projectId) {
    if (!projectId) {
      setDetail(null);
      setTiersDraft([]);
      setAnalytics(null);
      return;
    }

    try {
      const nextDetail = await api.getDeliveryProject(projectId);
      setDetail(nextDetail);
      syncFromDetail(nextDetail);
    } catch (loadError) {
      setGeneralStatus(loadError.message || "Unable to load campaign.");
      setDetail(null);
    }

    setAnalyticsStatus("Loading analytics…");
    try {
      const nextAnalytics = await api.getDeliveryAnalytics(projectId, 14);
      setAnalytics(nextAnalytics.analytics);
      setAnalyticsStatus("");
    } catch (analyticsError) {
      setAnalytics(null);
      setAnalyticsStatus(analyticsError.message || "Unable to load analytics.");
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const nextProjects = await loadDashboard();
      if (nextProjects.length) {
        const projectId = selectedProjectId || nextProjects[0].id;
        setSelectedProjectId(projectId);
        await loadProjectDetail(projectId);
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load delivery admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Auto-save: any change to configForm / tiersDraft triggers a debounced PUT.
  useEffect(() => {
    if (!selectedProjectId || !detail) return undefined;
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return undefined;
    }
    clearTimeout(autoSaveTimerRef.current);
    setSaveStatus("Saving…");
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const nextDetail = await api.updateDeliveryProject(selectedProjectId, {
          ...configForm,
          tiers: tierConfigPayload(tiersDraft),
        });
        setDetail(nextDetail);
        // Merge: keep current tier ids/drafts stable but update backerCount + persisted ids
        skipAutoSaveRef.current = true;
        setTiersDraft((current) => {
          const byOriginal = current.map((tier, index) => {
            const fresh = nextDetail.tiers[index];
            if (!fresh) return tier;
            return {
              id: fresh.id,
              name: fresh.name || tier.name,
              messageOverride: fresh.messageOverride || "",
              additionalLinkLabel: fresh.additionalLinkLabel || "",
              additionalLinkUrl: fresh.additionalLinkUrl || "",
              fileIds: [...(fresh.fileIds || [])],
              backerCount: fresh.backerCount || 0,
            };
          });
          return byOriginal;
        });
        setTransientStatus("Saved");
        loadDashboard().catch(() => {});
      } catch (saveError) {
        setSaveStatus(saveError.message || "Save failed.");
      }
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [configForm, tiersDraft, selectedProjectId]);

  // Clear backer selection on outside click.
  useEffect(() => {
    function handlePointerDown(event) {
      if (audienceListRef.current?.contains(event.target)) return;
      if (bulkBarRef.current?.contains(event.target)) return;
      // Ignore clicks inside any open dialog — they shouldn't deselect.
      if (event.target.closest?.(".delivery-dialog")) return;
      setSelectedBackerIds([]);
      setSelectionAnchorId("");
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // Close ⋯ menu on outside click.
  useEffect(() => {
    function handler(event) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("pointerdown", handler);
      return () => document.removeEventListener("pointerdown", handler);
    }
    return undefined;
  }, [menuOpen]);

  async function handleCreateProject(event) {
    event.preventDefault();
    setProjectFormStatus("Creating campaign…");
    try {
      const response = await api.createDeliveryProject(projectForm);
      setProjectForm(emptyProjectForm());
      setShowCreateForm(false);
      setProjectFormStatus("");
      const nextProjects = await loadDashboard();
      const projectId = response.project.id || nextProjects[0]?.id || "";
      setSelectedProjectId(projectId);
      await loadProjectDetail(projectId);
    } catch (createError) {
      setProjectFormStatus(createError.message || "Unable to create campaign.");
    }
  }

  async function handleUploadCover(file) {
    if (!selectedProjectId) throw new Error("Choose a campaign first.");
    await api.uploadDeliveryCover(selectedProjectId, file);
    await loadProjectDetail(selectedProjectId);
    loadDashboard().catch(() => {});
  }

  async function handleUploadPdfs(files) {
    if (!selectedProjectId) throw new Error("Choose a campaign first.");
    for (const file of files) {
      await api.uploadDeliveryPdf(selectedProjectId, file);
    }
    await loadProjectDetail(selectedProjectId);
    loadDashboard().catch(() => {});
  }

  function requestDeleteFile(file) {
    setConfirmDialog({
      title: "Delete file",
      body: (
        <p>
          Remove <strong>{file.originalFilename}</strong> from this campaign? Backers will no longer
          be able to access it.
        </p>
      ),
      confirmLabel: "Delete file",
      destructive: true,
      onConfirm: async () => {
        await api.deleteDeliveryFile(selectedProjectId, file.id);
        await loadProjectDetail(selectedProjectId);
        loadDashboard().catch(() => {});
        setConfirmDialog(null);
      },
    });
  }

  async function handleDeleteProject() {
    setConfirmDialog({
      title: "Delete campaign",
      body: (
        <p>
          Permanently delete <strong>{detail?.project.title}</strong> and every file uploaded to it?
          Backers will lose access immediately.
        </p>
      ),
      confirmLabel: "Delete campaign",
      destructive: true,
      onConfirm: async () => {
        await api.deleteDeliveryProject(selectedProjectId);
        const nextProjects = await loadDashboard();
        const nextProjectId = nextProjects[0]?.id || "";
        setSelectedProjectId(nextProjectId);
        if (nextProjectId) {
          await loadProjectDetail(nextProjectId);
        } else {
          setDetail(null);
        }
        setConfirmDialog(null);
      },
    });
  }

  // ----- Audience: tier edits -----
  function handleTierFieldChange(index, key, value) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) => (tierIndex === index ? { ...tier, [key]: value } : tier))
    );
  }

  function handleToggleFile(index, fileId) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) => {
        if (tierIndex !== index) return tier;
        const nextFileIds = tier.fileIds.includes(fileId)
          ? tier.fileIds.filter((id) => id !== fileId)
          : [...tier.fileIds, fileId];
        return { ...tier, fileIds: nextFileIds };
      })
    );
  }

  function handleAddTier() {
    setTiersDraft((current) => [
      ...current,
      createTierDraft(current.length, detail?.files?.map((file) => file.id) || []),
    ]);
  }

  function handleRemoveTier(index) {
    setTiersDraft((current) => current.filter((_, tierIndex) => tierIndex !== index));
  }

  // ----- Audience: backers -----
  function handleSelectBacker(backerId, event) {
    if (!detail?.backers?.length) return;
    const orderedIds = detail.backers.map((backer) => backer.id);
    const clickedIndex = orderedIds.indexOf(backerId);
    if (clickedIndex === -1) return;

    if (event.shiftKey) {
      const anchorId = selectionAnchorId || selectedBackerIds[0] || backerId;
      const anchorIndex = orderedIds.indexOf(anchorId);
      const rangeStart = Math.min(anchorIndex === -1 ? clickedIndex : anchorIndex, clickedIndex);
      const rangeEnd = Math.max(anchorIndex === -1 ? clickedIndex : anchorIndex, clickedIndex);
      setSelectedBackerIds(orderedIds.slice(rangeStart, rangeEnd + 1));
      setSelectionAnchorId(anchorId);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      setSelectedBackerIds((current) =>
        current.includes(backerId) ? current.filter((id) => id !== backerId) : [...current, backerId]
      );
      setSelectionAnchorId(backerId);
      return;
    }

    setSelectedBackerIds([backerId]);
    setSelectionAnchorId(backerId);
  }

  function startEditingBacker(backer) {
    setEditingBackerId(backer.id);
    setBackerDraft({ email: backer.email, tierId: backer.tierId || detail?.tiers?.[0]?.id || "" });
  }

  async function handleSaveBacker(backerId) {
    if (!selectedProjectId) return;
    try {
      await api.updateDeliveryBacker(selectedProjectId, {
        id: backerId,
        email: backerDraft.email,
        tierId: backerDraft.tierId,
      });
      setEditingBackerId("");
      await loadProjectDetail(selectedProjectId);
      loadDashboard().catch(() => {});
      setTransientStatus("Backer saved");
    } catch (saveError) {
      setGeneralStatus(saveError.message || "Unable to save backer.");
    }
  }

  async function moveBackersToTier(backerIds, tierId) {
    if (!selectedProjectId || !backerIds.length || !tierId) return;
    try {
      await api.moveDeliveryBackers(selectedProjectId, backerIds, tierId);
      await loadProjectDetail(selectedProjectId);
      setSelectedBackerIds(backerIds);
      setSelectionAnchorId(backerIds[0] || "");
      loadDashboard().catch(() => {});
      setTransientStatus(`Moved ${backerIds.length} backer${backerIds.length === 1 ? "" : "s"}`);
    } catch (moveError) {
      setGeneralStatus(moveError.message || "Unable to move backers.");
    }
  }

  async function handleAddAddon(backerId, fileId) {
    if (!selectedProjectId || !fileId) return;
    try {
      await api.addDeliveryBackerAddon(selectedProjectId, backerId, fileId);
      await loadProjectDetail(selectedProjectId);
      setTransientStatus("Add-on added");
    } catch (addonError) {
      setGeneralStatus(addonError.message || "Unable to add add-on.");
    }
  }

  async function handleRemoveAddon(backerId, fileId) {
    if (!selectedProjectId || !fileId) return;
    try {
      await api.removeDeliveryBackerAddon(selectedProjectId, backerId, fileId);
      await loadProjectDetail(selectedProjectId);
      setTransientStatus("Add-on removed");
    } catch (addonError) {
      setGeneralStatus(addonError.message || "Unable to remove add-on.");
    }
  }

  function requestDeleteBacker(backer) {
    setConfirmDialog({
      title: "Delete backer",
      body: (
        <p>
          Remove <strong>{backer.email}</strong> from this campaign? Their delivery link will stop
          working immediately.
        </p>
      ),
      confirmLabel: "Delete backer",
      destructive: true,
      onConfirm: async () => {
        await api.deleteDeliveryBacker(selectedProjectId, backer.id);
        setSelectedBackerIds((current) => current.filter((id) => id !== backer.id));
        await loadProjectDetail(selectedProjectId);
        loadDashboard().catch(() => {});
        setConfirmDialog(null);
      },
    });
  }

  function requestDeleteSelected() {
    if (!selectedBackerIds.length) return;
    setConfirmDialog({
      title: `Delete ${selectedBackerIds.length} backer${selectedBackerIds.length === 1 ? "" : "s"}`,
      body: (
        <p>
          Remove the {selectedBackerIds.length} selected backer
          {selectedBackerIds.length === 1 ? "" : "s"} from this campaign? Their delivery links will
          stop working immediately.
        </p>
      ),
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        for (const id of selectedBackerIds) {
          // Sequential to keep errors actionable.
          // eslint-disable-next-line no-await-in-loop
          await api.deleteDeliveryBacker(selectedProjectId, id);
        }
        setSelectedBackerIds([]);
        await loadProjectDetail(selectedProjectId);
        loadDashboard().catch(() => {});
        setConfirmDialog(null);
      },
    });
  }

  async function handleBulkAddAddon(fileId) {
    if (!selectedBackerIds.length || !fileId) return;
    try {
      for (const id of selectedBackerIds) {
        // eslint-disable-next-line no-await-in-loop
        await api.addDeliveryBackerAddon(selectedProjectId, id, fileId);
      }
      await loadProjectDetail(selectedProjectId);
      setTransientStatus(`Add-on added to ${selectedBackerIds.length}`);
    } catch (addonError) {
      setGeneralStatus(addonError.message || "Bulk add-on failed.");
    }
  }

  // ----- Drag and drop -----
  function handleBackerDragStart(backer, event) {
    event.stopPropagation();
    const ids = selectedBackerIds.includes(backer.id) ? selectedBackerIds : [backer.id];
    if (!selectedBackerIds.includes(backer.id)) {
      setSelectedBackerIds([backer.id]);
      setSelectionAnchorId(backer.id);
    }
    setDraggedBackerIds(ids);
    try {
      event.dataTransfer.setData("text/plain", ids.join(","));
    } catch {
      // noop
    }
  }
  function handleBackerDragEnd() {
    setDraggedBackerIds([]);
    setDragOverTierId("");
  }
  function handleDragOverTier(event, tier) {
    event.preventDefault();
    if (draggedBackerIds.length) setDragOverTierId(tier.id);
  }
  function handleDragLeaveTier(tier) {
    if (dragOverTierId === tier.id) setDragOverTierId("");
  }
  function handleDropOnTier(event, tier) {
    event.preventDefault();
    const droppedIds = draggedBackerIds.length
      ? draggedBackerIds.filter((id) => {
          const backer = detail?.backers.find((b) => b.id === id);
          return backer && backer.tierId !== tier.id;
        })
      : [];
    setDraggedBackerIds([]);
    setDragOverTierId("");
    if (droppedIds.length) moveBackersToTier(droppedIds, tier.id);
  }

  // ----- Import per tier -----
  function handleImportTextChange(tierId, value) {
    setTierImportTexts((current) => ({ ...current, [tierId]: value }));
  }

  async function handleImportEmails(tier) {
    const text = tierImportTexts[tier.id] || "";
    const emails = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!emails.length) {
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: "Paste at least one email first.",
      }));
      return;
    }
    const csv = ["email,tier", ...emails.map((email) => `${email},${tier.name}`)].join("\n");
    setTierImportStatuses((current) => ({ ...current, [tier.id]: "Importing…" }));
    try {
      const result = await api.importDeliveryBackers(selectedProjectId, csv);
      setTierImportTexts((current) => ({ ...current, [tier.id]: "" }));
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: `Imported ${result.summary.importedCount}. Skipped ${result.summary.skippedExistingCount} existing.`,
      }));
      await loadProjectDetail(selectedProjectId);
      loadDashboard().catch(() => {});
    } catch (importError) {
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: importError.message || "Import failed.",
      }));
    }
  }

  // ----- Email preview -----
  function handlePreviewEmail(tier, previewBacker) {
    const coverUrl = detail?.currentCover ? fileRoute(detail.currentCover.id) : "";
    const { html } = buildDeliveryEmail({
      projectTitle: detail.project.title,
      creatorName: detail.project.creatorName,
      shortMessage: tier?.messageOverride || detail.project.shortMessage,
      accessUrl: previewBacker
        ? `${window.location.origin}/a/${previewBacker.accessToken}`
        : `${window.location.origin}/a/preview`,
      coverImageUrl: coverUrl,
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ----- Send dialog -----
  function openSendDialog(kind) {
    if (!detail) return;
    if (kind === "selected") {
      setSendDialog({ kind: "selected", backerIds: [...selectedBackerIds] });
    } else {
      setSendDialog({ kind });
    }
    setMenuOpen(false);
  }

  async function handleSend(target) {
    if (!selectedProjectId) return;
    const options = {};
    if (target.kind === "resend-all") options.resendAll = true;
    if (target.kind === "selected") options.backerIds = target.backerIds;
    const result = await api.sendDeliveryEmails(selectedProjectId, options);
    if (!result.targetedCount) {
      setTransientStatus("No unsent backers to email.");
    } else {
      setTransientStatus(
        `Sent ${result.sentCount} email${result.sentCount === 1 ? "" : "s"}${
          result.failedCount ? ` — ${result.failedCount} failed` : ""
        }.`
      );
    }
    setSendDialog(null);
    await loadProjectDetail(selectedProjectId);
    loadDashboard().catch(() => {});
  }

  async function handleTestSend(testTo) {
    if (!selectedProjectId) return;
    await api.testDeliveryEmail(selectedProjectId, testTo);
  }

  // ----- Render -----
  if (loading) {
    return <div className="state-shell">Loading delivery workspace…</div>;
  }
  if (error) {
    return <div className="state-shell">{error}</div>;
  }

  const coverUrl = detail?.currentCover ? fileRoute(detail.currentCover.id) : "";
  const hasFiles = Boolean(detail?.files?.length);
  const hasBackers = Boolean(detail?.backers?.length);
  const sendDisabled = !hasFiles || !hasBackers;
  const noCampaign = !detail;

  return (
    <section className="editor-shell delivery-workspace delivery-workspace--streamlined">
      <header className="delivery-topbar">
        <div className="delivery-topbar__left">
          <p className="editor-header__eyebrow">Delivery</p>
          <div className="delivery-topbar__picker">
            {projects.length ? (
              <select
                value={selectedProjectId}
                onChange={async (event) => {
                  const projectId = event.target.value;
                  setSelectedProjectId(projectId);
                  await loadProjectDetail(projectId);
                }}
                aria-label="Campaign"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="delivery-topbar__name">No campaigns yet</span>
            )}
            <button
              className="button-secondary button-compact"
              type="button"
              onClick={() => setShowCreateForm((current) => !current)}
            >
              {showCreateForm ? "Close" : "New campaign"}
            </button>
          </div>
        </div>

        <div className="delivery-topbar__right">
          {saveStatus ? <span className="delivery-topbar__save">{saveStatus}</span> : null}
          {detail ? (
            <>
              <div className="delivery-topbar__send-group">
                <button
                  className="button-primary"
                  type="button"
                  disabled={sendDisabled}
                  onClick={() => openSendDialog("all-unsent")}
                >
                  Send emails
                </button>
                <button
                  className="button-secondary button-compact"
                  type="button"
                  disabled={sendDisabled}
                  onClick={() => openSendDialog("resend-all")}
                  title="Resend to every backer, including already-emailed"
                >
                  Resend all
                </button>
              </div>
              <div className="delivery-topbar__menu" ref={menuRef}>
                <button
                  className="button-secondary button-compact"
                  type="button"
                  onClick={() => setMenuOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  ⋯
                </button>
                {menuOpen ? (
                  <div className="delivery-topbar__menu-panel" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowCreateForm(false);
                        setMenuOpen(false);
                        const slugLabel = window.prompt(
                          "Campaign slug (URL identifier)",
                          configForm.slug
                        );
                        if (slugLabel !== null) {
                          setConfigForm((current) => ({ ...current, slug: slugLabel.trim() }));
                        }
                      }}
                    >
                      Edit slug
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="delivery-topbar__menu-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDeleteProject();
                      }}
                    >
                      Delete campaign
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {(showCreateForm || noCampaign) ? (
        <section className="editor-card delivery-section">
          <div className="delivery-section__header">
            <h2>{noCampaign ? "Create your first campaign" : "Create campaign"}</h2>
          </div>
          <form className="delivery-form-grid" onSubmit={handleCreateProject}>
            <label>
              <span>Campaign title</span>
              <input
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Creator name</span>
              <input
                value={projectForm.creatorName}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, creatorName: event.target.value }))
                }
              />
            </label>
            <label className="delivery-form-grid__full">
              <span>Default message</span>
              <textarea
                rows={3}
                value={projectForm.shortMessage}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, shortMessage: event.target.value }))
                }
              />
            </label>
            <label className="delivery-form-grid__full">
              <span>Description</span>
              <textarea
                rows={4}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <div className="delivery-inline-actions delivery-form-grid__full">
              <button className="button-primary" type="submit">
                Create campaign
              </button>
            </div>
            {projectFormStatus ? <p className="status-line">{projectFormStatus}</p> : null}
          </form>
        </section>
      ) : null}

      {detail ? (
        <>
          <nav className="delivery-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "setup"}
              className={`delivery-tab${activeTab === "setup" ? " is-active" : ""}`}
              onClick={() => setActiveTab("setup")}
            >
              Setup
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "analytics"}
              className={`delivery-tab${activeTab === "analytics" ? " is-active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              Analytics
            </button>
          </nav>

          {activeTab === "setup" ? (
            <div className="delivery-sections">
              <section className="editor-card delivery-section">
                <div className="delivery-section__header">
                  <h2>Campaign details</h2>
                  <span className="status-line">Auto-saves as you type.</span>
                </div>
                <div className="delivery-form-grid">
                  <label>
                    <span>Campaign title</span>
                    <input
                      value={configForm.title}
                      onChange={(event) =>
                        setConfigForm((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>Creator name</span>
                    <input
                      value={configForm.creatorName}
                      onChange={(event) =>
                        setConfigForm((current) => ({
                          ...current,
                          creatorName: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="delivery-form-grid__full">
                    <span>Default message</span>
                    <textarea
                      rows={3}
                      value={configForm.shortMessage}
                      onChange={(event) =>
                        setConfigForm((current) => ({
                          ...current,
                          shortMessage: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="delivery-form-grid__full">
                    <span>Description</span>
                    <textarea
                      rows={4}
                      value={configForm.description}
                      onChange={(event) =>
                        setConfigForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {generalStatus ? <p className="status-line">{generalStatus}</p> : null}
              </section>

              <DeliveryAssets
                cover={detail.currentCover}
                coverUrl={coverUrl}
                files={detail.files}
                onUploadCover={handleUploadCover}
                onUploadPdfs={handleUploadPdfs}
                onOpenPdf={(file) => setPdfDialog(file)}
                onRequestDelete={requestDeleteFile}
                onRenameFile={async (file, displayName) => {
                  await api.updateDeliveryFile(selectedProjectId, file.id, { displayName });
                  await loadProjectDetail(selectedProjectId);
                }}
              />

              <DeliveryAudience
                detail={detail}
                tiersDraft={tiersDraft}
                files={detail.files}
                selectedBackerIds={selectedBackerIds}
                editingBackerId={editingBackerId}
                backerDraft={backerDraft}
                draggedBackerIds={draggedBackerIds}
                dragOverTierId={dragOverTierId}
                tierImportTexts={tierImportTexts}
                tierImportStatuses={tierImportStatuses}
                listRef={audienceListRef}
                onAddTier={handleAddTier}
                onTierFieldChange={handleTierFieldChange}
                onToggleFile={handleToggleFile}
                onRemoveTier={handleRemoveTier}
                onImportEmails={handleImportEmails}
                onImportTextChange={handleImportTextChange}
                onSelectBacker={handleSelectBacker}
                onStartEditBacker={startEditingBacker}
                onCancelEditBacker={() => setEditingBackerId("")}
                onSaveBacker={handleSaveBacker}
                onSetBackerDraft={setBackerDraft}
                onRequestDeleteBacker={requestDeleteBacker}
                onAddAddon={handleAddAddon}
                onRemoveAddon={handleRemoveAddon}
                onPreviewEmail={handlePreviewEmail}
                onDropOnTier={handleDropOnTier}
                onDragOverTier={handleDragOverTier}
                onDragLeaveTier={handleDragLeaveTier}
                onBackerDragStart={handleBackerDragStart}
                onBackerDragEnd={handleBackerDragEnd}
              />
            </div>
          ) : (
            <DeliveryAnalytics analytics={analytics} status={analyticsStatus} />
          )}
        </>
      ) : null}

      {summary?.storage ? (
        <p className="status-line delivery-footer-note">
          Storage: {summary.storage.database}. Uploads:{" "}
          {summary.storage.uploadsConfigured ? "bucket ready" : "not configured"}.
        </p>
      ) : null}

      <DeliveryBulkBar
        innerRef={bulkBarRef}
        selectedCount={selectedBackerIds.length}
        tiers={detail?.tiers || []}
        files={detail?.files || []}
        onMoveToTier={(tierId) => moveBackersToTier(selectedBackerIds, tierId)}
        onAddAddon={handleBulkAddAddon}
        onSendSelected={() => openSendDialog("selected")}
        onDeleteSelected={requestDeleteSelected}
        onClearSelection={() => {
          setSelectedBackerIds([]);
          setSelectionAnchorId("");
        }}
      />

      <DeliveryConfirmDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title || ""}
        body={confirmDialog?.body}
        confirmLabel={confirmDialog?.confirmLabel}
        destructive={confirmDialog?.destructive}
        onConfirm={confirmDialog?.onConfirm}
        onClose={() => setConfirmDialog(null)}
      />

      <DeliveryPdfDialog
        open={Boolean(pdfDialog)}
        file={pdfDialog}
        pdfUrl={pdfDialog ? fileRoute(pdfDialog.id) + "/content" : ""}
        onClose={() => setPdfDialog(null)}
      />

      <DeliverySendDialog
        open={Boolean(sendDialog)}
        target={sendDialog}
        detail={detail}
        coverUrl={coverUrl}
        onClose={() => setSendDialog(null)}
        onSend={handleSend}
        onTest={handleTestSend}
      />
    </section>
  );
}
