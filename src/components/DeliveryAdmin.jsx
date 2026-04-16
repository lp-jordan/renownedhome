import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { buildDeliveryEmail } from "../lib/resendEmail";
import InlinePdfReader from "./InlinePdfReader";

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
  };
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length; index += 1) {
    unit = units[index];
    if (size < 1024 || index === units.length - 1) {
      break;
    }
    size /= 1024;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function fileRoute(fileId) {
  return `/api/delivery/files/${encodeURIComponent(fileId)}`;
}

function statusClass(text) {
  if (!text) return "status-line";
  const lower = text.toLowerCase();
  if (/failed|unable|error|unavailable|invalid|not configured|not found/.test(lower)) {
    return "status-line status-line--error";
  }
  if (/saved|created|imported|deleted|sent|updated|moved|uploaded/.test(lower)) {
    return "status-line status-line--success";
  }
  return "status-line";
}

function formatRate(count, total) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((count / total) * 100)}%`;
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

function useAutoClear(setter, delay = 4000) {
  const timer = useRef(null);
  return useCallback(
    (text) => {
      setter(text);
      clearTimeout(timer.current);
      if (text && statusClass(text).includes("status-line--success")) {
        timer.current = setTimeout(() => setter(""), delay);
      }
    },
    [setter, delay]
  );
}

export default function DeliveryAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsStatus, setAnalyticsStatus] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [assetStatus, setAssetStatusRaw] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [configForm, setConfigForm] = useState(emptyProjectForm());
  const [savedConfigRef, setSavedConfigRef] = useState(emptyProjectForm());
  const [savedTiersRef, setSavedTiersRef] = useState([]);
  const [tiersDraft, setTiersDraft] = useState([]);
  const [projectStatus, setProjectStatus] = useState("");
  const [configStatus, setConfigStatus] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [tierImportTexts, setTierImportTexts] = useState({});
  const [tierImportStatuses, setTierImportStatuses] = useState({});
  const [sendStatus, setSendStatus] = useState("");
  const [selectedBackerIds, setSelectedBackerIds] = useState([]);
  const [backerStatus, setBackerStatus] = useState("");
  const [editingBackerId, setEditingBackerId] = useState("");
  const [backerDraft, setBackerDraft] = useState({ email: "", tierId: "" });
  const [expandedTierIds, setExpandedTierIds] = useState([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState("");
  const [draggedBackerIds, setDraggedBackerIds] = useState([]);
  const [dragOverTierId, setDragOverTierId] = useState("");
  // confirmState: { key: string, label: string } | null — tracks which action is awaiting inline confirm
  const [confirmState, setConfirmState] = useState(null);
  const backersListRef = useRef(null);

  const setAssetStatus = useAutoClear(setAssetStatusRaw);
  const setProjectStatusAC = useAutoClear(setProjectStatus);
  const setConfigStatusAC = useAutoClear(setConfigStatus);
  const setSendStatusAC = useAutoClear(setSendStatus);
  const setBackerStatusAC = useAutoClear(setBackerStatus);

  async function loadDashboard() {
    const [nextSummary, nextProjects] = await Promise.all([
      api.getDeliverySummary(),
      api.getDeliveryProjects(),
    ]);
    setSummary(nextSummary);
    setProjects(nextProjects.projects);
    return nextProjects.projects;
  }

  function syncConfig(nextDetail) {
    const nextConfig = {
      title: nextDetail.project.title || "",
      creatorName: nextDetail.project.creatorName || "",
      slug: nextDetail.project.slug || "",
      shortMessage: nextDetail.project.shortMessage || "",
      description: nextDetail.project.description || "",
    };
    const nextTiers = (nextDetail.tiers || []).map((tier) => ({
      id: tier.id,
      name: tier.name || "",
      messageOverride: tier.messageOverride || "",
      additionalLinkLabel: tier.additionalLinkLabel || "",
      additionalLinkUrl: tier.additionalLinkUrl || "",
      fileIds: [...(tier.fileIds || [])],
      backerCount: tier.backerCount || 0,
    }));
    setConfigForm(nextConfig);
    setSavedConfigRef(nextConfig);
    setTiersDraft(nextTiers);
    setSavedTiersRef(nextTiers);
    setSelectedBackerIds([]);
    setEditingBackerId("");
    setBackerDraft({ email: "", tierId: nextDetail.tiers?.[0]?.id || "" });
    setTierImportTexts({});
    setTierImportStatuses({});
    setExpandedTierIds((current) => {
      const tierIds = nextDetail.tiers?.map((tier) => tier.id) || [];
      if (!tierIds.length) {
        return [];
      }
      const preserved = current.filter((tierId) => tierIds.includes(tierId));
      return preserved.length ? preserved : [tierIds[0]];
    });
  }

  async function loadProjectDetail(projectId) {
    if (!projectId) {
      setDetail(null);
      setTiersDraft([]);
      setAnalytics(null);
      return;
    }

    setDetailStatus("Loading campaign...");
    setAnalyticsStatus("Loading analytics...");
    try {
      const nextDetail = await api.getDeliveryProject(projectId);
      setDetail(nextDetail);
      syncConfig(nextDetail);
      setDetailStatus("");

      try {
        const nextAnalytics = await api.getDeliveryAnalytics(projectId, 14);
        setAnalytics(nextAnalytics.analytics);
        setAnalyticsStatus("");
      } catch (analyticsError) {
        setAnalytics(null);
        setAnalyticsStatus(analyticsError.message || "Unable to load analytics.");
      }
    } catch (loadError) {
      setDetailStatus(loadError.message || "Unable to load campaign detail.");
      setDetail(null);
      setAnalytics(null);
      setAnalyticsStatus("");
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

  useEffect(() => {
    setExpandedTierIds((current) => {
      const tierIds = tiersDraft.map((tier) => tier.id);
      if (!tierIds.length) {
        return [];
      }

      const preserved = current.filter((tierId) => tierIds.includes(tierId));
      const newIds = tierIds.filter((tierId) => !preserved.includes(tierId));
      return [...preserved, ...newIds];
    });
  }, [tiersDraft]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!backersListRef.current) {
        return;
      }
      if (backersListRef.current.contains(event.target)) {
        return;
      }
      setSelectedBackerIds([]);
      setSelectionAnchorId("");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  async function handleCreateProject(event) {
    event.preventDefault();
    setProjectStatus("Creating campaign...");
    try {
      const response = await api.createDeliveryProject(projectForm);
      setProjectForm(emptyProjectForm());
      setProjectStatusAC("Campaign created.");
      setShowProjectForm(false);
      const nextProjects = await loadDashboard();
      const projectId = response.project.id || nextProjects[0]?.id || "";
      setSelectedProjectId(projectId);
      await loadProjectDetail(projectId);
    } catch (createError) {
      setProjectStatus(createError.message || "Unable to create campaign.");
    }
  }

  async function handleSaveConfig() {
    if (!selectedProjectId) {
      setConfigStatus("Choose a campaign first.");
      return;
    }

    setConfigStatus("Saving...");
    try {
      const payload = {
        ...configForm,
        tiers: tiersDraft.map((tier, index) => ({
          id: tier.isNew ? undefined : tier.id,
          name: tier.name,
          messageOverride: tier.messageOverride,
          additionalLinkLabel: tier.additionalLinkLabel,
          additionalLinkUrl: tier.additionalLinkUrl,
          fileIds: tier.fileIds,
          sortOrder: index,
        })),
      };
      const nextDetail = await api.updateDeliveryProject(selectedProjectId, payload);
      setDetail(nextDetail);
      syncConfig(nextDetail);
      setConfigStatusAC("Campaign saved.");
      await loadDashboard();
    } catch (saveError) {
      setConfigStatus(saveError.message || "Campaign save failed.");
    }
  }

  async function handleImportBackersToTier(tier) {
    const importText = tierImportTexts[tier.id] || "";
    const emails = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!selectedProjectId || !emails.length) {
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: "Paste at least one email first.",
      }));
      return;
    }

    const csvForTier = ["email,tier", ...emails.map((email) => `${email},${tier.name}`)].join("\n");
    setTierImportStatuses((current) => ({
      ...current,
      [tier.id]: `Importing into ${tier.name}...`,
    }));

    try {
      const result = await api.importDeliveryBackers(selectedProjectId, csvForTier);
      setTierImportTexts((current) => ({ ...current, [tier.id]: "" }));
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: `Imported ${result.summary.importedCount}. Skipped ${result.summary.skippedExistingCount} existing and ${result.summary.skippedUnknownTierCount} unmatched row${result.summary.skippedUnknownTierCount === 1 ? "" : "s"}.`,
      }));
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
    } catch (importError) {
      setTierImportStatuses((current) => ({
        ...current,
        [tier.id]: importError.message || "Backer import failed.",
      }));
    }
  }

  async function handleUpload(kind, event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!selectedProjectId) {
      setAssetStatus("Create or select a campaign first.");
      return;
    }

    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setAssetStatus("Choose a file first.");
      return;
    }

    setIsUploading(true);
    setAssetStatus(kind === "cover" ? "Uploading cover..." : "Uploading PDF...");
    try {
      if (kind === "cover") {
        await api.uploadDeliveryCover(selectedProjectId, file);
      } else {
        await api.uploadDeliveryPdf(selectedProjectId, file);
      }
      formElement.reset();
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setAssetStatus(kind === "cover" ? "Cover updated." : "PDF uploaded.");
    } catch (uploadError) {
      setAssetStatus(uploadError.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSendEmails({ resendAll = false } = {}) {
    if (!selectedProjectId) {
      setSendStatus("Choose a campaign first.");
      return;
    }

    setSendStatus(resendAll ? "Resending delivery emails..." : "Sending unsent delivery emails...");
    try {
      const result = await api.sendDeliveryEmails(selectedProjectId, { resendAll });
      if (!result.targetedCount) {
        setSendStatus("No unsent backers left to email.");
      } else {
        setSendStatusAC(
          `${resendAll ? "Resent" : "Sent"} ${result.sentCount} email${result.sentCount === 1 ? "" : "s"}${
            result.skippedCount && !resendAll
              ? `, skipped ${result.skippedCount} already-sent`
              : ""
          }.${result.failedCount ? ` ${result.failedCount} failed.` : ""}`
        );
      }
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
    } catch (sendError) {
      setSendStatus(sendError.message || "Email sending failed.");
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId || !detail) {
      setDetailStatus("Choose a campaign first.");
      return;
    }

    setDetailStatus("Deleting campaign and bucket files...");
    try {
      await api.deleteDeliveryProject(selectedProjectId);
      const nextProjects = await loadDashboard();
      const nextProjectId = nextProjects[0]?.id || "";
      setSelectedProjectId(nextProjectId);
      setSendStatus("");
      setConfigStatus("");
      setConfirmState(null);
      if (nextProjectId) {
        await loadProjectDetail(nextProjectId);
      } else {
        setDetail(null);
      }
      setDetailStatus("Campaign deleted.");
    } catch (deleteError) {
      setDetailStatus(deleteError.message || "Campaign deletion failed.");
    }
  }

  async function handleDeleteFile(file) {
    if (!selectedProjectId || !file) {
      return;
    }

    setAssetStatus(`Deleting ${file.kind === "pdf" ? "PDF" : "cover"}...`);
    try {
      await api.deleteDeliveryFile(selectedProjectId, file.id);
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setAssetStatus(`${file.kind === "pdf" ? "PDF" : "Cover"} deleted.`);
      setConfirmState(null);
    } catch (deleteError) {
      setAssetStatus(deleteError.message || "File deletion failed.");
    }
  }

  function handleTierChange(index, key, value) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [key]: value } : tier
      )
    );
  }

  function toggleTierFile(index, fileId) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) => {
        if (tierIndex !== index) {
          return tier;
        }
        const nextFileIds = tier.fileIds.includes(fileId)
          ? tier.fileIds.filter((id) => id !== fileId)
          : [...tier.fileIds, fileId];
        return { ...tier, fileIds: nextFileIds };
      })
    );
  }

  function addTier() {
    setTiersDraft((current) => [
      ...current,
      createTierDraft(
        current.length,
        detail?.files?.map((file) => file.id) || []
      ),
    ]);
  }

  function removeTier(index) {
    setTiersDraft((current) => current.filter((_, tierIndex) => tierIndex !== index));
  }

  function startEditingBacker(backer) {
    setEditingBackerId(backer.id);
    setBackerDraft({
      email: backer.email,
      tierId: backer.tierId || detail?.tiers?.[0]?.id || "",
    });
    setBackerStatus("");
  }

  function handleBackerSelection(backerId, event) {
    if (!detail?.backers?.length) {
      return;
    }

    const orderedIds = detail.backers.map((backer) => backer.id);
    const clickedIndex = orderedIds.indexOf(backerId);
    if (clickedIndex === -1) {
      return;
    }

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
        current.includes(backerId)
          ? current.filter((id) => id !== backerId)
          : [...current, backerId]
      );
      setSelectionAnchorId(backerId);
      return;
    }

    setSelectedBackerIds([backerId]);
    setSelectionAnchorId(backerId);
  }

  function toggleTierSelection(tierId) {
    if (!detail?.backers?.length) {
      return;
    }

    const tierBackerIds = detail.backers
      .filter((backer) => backer.tierId === tierId)
      .map((backer) => backer.id);
    if (!tierBackerIds.length) {
      return;
    }

    setSelectedBackerIds((current) => {
      const allSelected = tierBackerIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !tierBackerIds.includes(id));
      }
      return [...new Set([...current, ...tierBackerIds])];
    });
    setSelectionAnchorId(tierBackerIds[0]);
  }

  function toggleTierExpanded(tierId) {
    setExpandedTierIds((current) =>
      current.includes(tierId)
        ? current.filter((id) => id !== tierId)
        : [...current, tierId]
    );
  }

  async function handleSaveBacker(backerId) {
    if (!selectedProjectId) {
      return;
    }

    setBackerStatus("Saving backer...");
    try {
      await api.updateDeliveryBacker(selectedProjectId, {
        id: backerId,
        email: backerDraft.email,
        tierId: backerDraft.tierId,
      });
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setBackerStatusAC("Backer updated.");
    } catch (saveError) {
      setBackerStatus(saveError.message || "Unable to update backer.");
    }
  }

  async function moveBackersToTier(backerIds, tierId) {
    if (!selectedProjectId || !backerIds.length || !tierId) {
      setBackerStatus("Select backers and choose a tier first.");
      return;
    }

    setBackerStatus("Moving backers...");
    try {
      await api.moveDeliveryBackers(selectedProjectId, backerIds, tierId);
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setBackerStatusAC("Backers moved.");
    } catch (moveError) {
      setBackerStatus(moveError.message || "Unable to move backers.");
    }
  }

  async function handleDropBackers(backer, tierId) {
    const idsToMove =
      backer && selectedBackerIds.includes(backer.id) ? selectedBackerIds : backer?.id ? [backer.id] : [];
    const movableIds = detail?.backers
      ?.filter((entry) => idsToMove.includes(entry.id) && entry.tierId !== tierId)
      .map((entry) => entry.id) || [];
    if (!selectedProjectId || !tierId || !movableIds.length) {
      setDraggedBackerIds([]);
      setDragOverTierId("");
      return;
    }

    setBackerStatus(movableIds.length > 1 ? "Moving backers..." : "Moving backer...");
    try {
      await moveBackersToTier(movableIds, tierId);
      setSelectedBackerIds(movableIds);
      setSelectionAnchorId(movableIds[0] || "");
    } catch {
      // handled in moveBackersToTier
    } finally {
      setDraggedBackerIds([]);
      setDragOverTierId("");
    }
  }

  function handleBackerDragStart(backer, event) {
    event.stopPropagation();
    const idsToDrag = selectedBackerIds.includes(backer.id) ? selectedBackerIds : [backer.id];
    if (!selectedBackerIds.includes(backer.id)) {
      setSelectedBackerIds([backer.id]);
      setSelectionAnchorId(backer.id);
    }
    setDraggedBackerIds(idsToDrag);
    try {
      event.dataTransfer.setData("text/plain", idsToDrag.join(","));
    } catch {
      // noop
    }
  }

  function handleBackerDragEnd() {
    setDraggedBackerIds([]);
    setDragOverTierId("");
  }

  async function handleDeleteBacker(backer) {
    if (!selectedProjectId) {
      return;
    }

    const confirmKey = `backer-${backer.id}`;
    if (confirmState?.key !== confirmKey) {
      setConfirmState({ key: confirmKey, label: `Delete ${backer.email}?` });
      return;
    }

    setConfirmState(null);
    setBackerStatus("Deleting backer...");
    try {
      await api.deleteDeliveryBacker(selectedProjectId, backer.id);
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setSelectedBackerIds((current) => current.filter((id) => id !== backer.id));
      setSelectionAnchorId((current) => (current === backer.id ? "" : current));
      setBackerStatusAC("Backer deleted.");
    } catch (deleteError) {
      setBackerStatus(deleteError.message || "Unable to delete backer.");
    }
  }

  if (loading) {
    return <div className="state-shell">Loading delivery workspace...</div>;
  }

  if (error) {
    return <div className="state-shell">{error}</div>;
  }

  const coverUrl = detail?.currentCover ? fileRoute(detail.currentCover.id) : "";
  const analyticsTimeline = analytics?.timeline || [];
  const analyticsTotals = analytics?.totals || null;
  const analyticsMaxCount = analyticsTimeline.reduce(
    (max, day) => Math.max(max, day.pageViews, day.downloads),
    0
  );
  const tierGroups = detail
    ? tiersDraft.map((tier, index) => {
        const persistedTier = detail.tiers.find((entry) => entry.id === tier.id);
        return {
          ...persistedTier,
          ...tier,
          isPersisted: Boolean(persistedTier),
          sortOrder: index,
          backers: detail.backers.filter((backer) => backer.tierId === tier.id),
        };
      })
    : [];
  const assignableTiers = detail
    ? detail.tiers.map((tier) => {
        const draftTier = tiersDraft.find((entry) => entry.id === tier.id);
        return draftTier ? { ...tier, name: draftTier.name || tier.name } : tier;
      })
    : [];
  const selectedCount = selectedBackerIds.length;
  const isDirty =
    JSON.stringify(configForm) !== JSON.stringify(savedConfigRef) ||
    JSON.stringify(tiersDraft.map(({ backerCount: _, ...t }) => t)) !==
      JSON.stringify(savedTiersRef.map(({ backerCount: _, ...t }) => t));

  return (
    <section className="editor-shell delivery-workspace delivery-workspace--streamlined">
      <div className="delivery-header delivery-header--compact">
        <div>
          <p className="editor-header__eyebrow">Delivery</p>
          <h1>Campaign Delivery</h1>
        </div>
        <div className="delivery-header__actions">
          {projects.length ? (
            <label className="delivery-project-picker">
              <span>Campaign{isDirty ? " *" : ""}</span>
              <select
                value={selectedProjectId}
                onChange={async (event) => {
                  const projectId = event.target.value;
                  if (isDirty) {
                    const confirmKey = "switch-campaign";
                    if (confirmState?.key !== confirmKey) {
                      setConfirmState({ key: confirmKey, label: "Unsaved changes will be lost. Switch anyway?" });
                      return;
                    }
                    setConfirmState(null);
                  }
                  setSelectedProjectId(projectId);
                  await loadProjectDetail(projectId);
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="button-primary"
            type="button"
            onClick={() => setShowProjectForm((current) => !current)}
          >
            {showProjectForm ? "Close" : "New Campaign"}
          </button>
        </div>
      </div>

      {confirmState?.key === "switch-campaign" ? (
        <div className="delivery-switch-confirm">
          <span>{confirmState.label}</span>
          <button
            className="button-secondary button-compact"
            type="button"
            onClick={async () => {
              const pendingSelect = document.querySelector(".delivery-project-picker select");
              const projectId = pendingSelect?.value || "";
              setConfirmState(null);
              if (projectId && projectId !== selectedProjectId) {
                setSelectedProjectId(projectId);
                await loadProjectDetail(projectId);
              }
            }}
          >
            Switch anyway
          </button>
          <button className="button-secondary button-compact" type="button" onClick={() => {
            const selectEl = document.querySelector(".delivery-project-picker select");
            if (selectEl) selectEl.value = selectedProjectId;
            setConfirmState(null);
          }}>
            Keep editing
          </button>
        </div>
      ) : null}

      {showProjectForm || !projects.length ? (
        <section className="editor-card delivery-section">
          <div className="delivery-section__header">
            <h2>Create Campaign</h2>
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
            <label className="delivery-form-grid__full">
              <span>Slug override</span>
              <input
                value={projectForm.slug}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, slug: event.target.value }))
                }
              />
            </label>
            <div className="delivery-inline-actions delivery-form-grid__full">
              <button className="button-primary" type="submit">
                Create Campaign
              </button>
            </div>
            {projectStatus ? <p className={statusClass(projectStatus)}>{projectStatus}</p> : null}
          </form>
        </section>
      ) : null}

      {detail ? (
        <div className="delivery-sections">
            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Campaign Setup</h2>
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
                      setConfigForm((current) => ({ ...current, creatorName: event.target.value }))
                    }
                  />
                </label>
                <label className="delivery-form-grid__full">
                  <span>Default message</span>
                  <textarea
                    rows={3}
                    value={configForm.shortMessage}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, shortMessage: event.target.value }))
                    }
                  />
                </label>
                <label className="delivery-form-grid__full">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={configForm.description}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
                <label className="delivery-form-grid__full">
                  <span>Slug override</span>
                  <input
                    value={configForm.slug}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, slug: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="delivery-inline-actions">
                <button className="button-primary" type="button" onClick={handleSaveConfig}>
                  Save All Changes
                </button>
                {confirmState?.key === "delete-campaign" ? (
                  <>
                    <span className="delivery-confirm-label">{confirmState.label}</span>
                    <button className="button-secondary delivery-confirm-yes" type="button" onClick={handleDeleteProject}>
                      Yes, delete
                    </button>
                    <button className="button-secondary" type="button" onClick={() => setConfirmState(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setConfirmState({ key: "delete-campaign", label: `Delete "${detail.project.title}"?` })}
                  >
                    Delete Campaign
                  </button>
                )}
              </div>
              {configStatus ? <p className={statusClass(configStatus)}>{configStatus}</p> : null}
              {detailStatus ? <p className={statusClass(detailStatus)}>{detailStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Summary</h2>
              </div>
              <div className="delivery-summary-strip">
                <div>
                  <span>Status</span>
                  <strong>{detail.project.status || "draft"}</strong>
                </div>
                <div>
                  <span>Backers</span>
                  <strong>{detail.backers.length}</strong>
                </div>
                <div>
                  <span>PDFs</span>
                  <strong>{detail.files.length}</strong>
                </div>
                <div>
                  <span>Tiers</span>
                  <strong>{detail.tiers.length}</strong>
                </div>
              </div>
              {detail.tiers.length ? (
                <div className="delivery-mini-list">
                  {detail.tiers.map((tier) => (
                    <div key={tier.id} className="delivery-mini-list__item">
                      <strong>{tier.name}</strong>
                      <span>{tier.backerCount} backer{tier.backerCount === 1 ? "" : "s"}</span>
                      <span>{(tier.fileIds || []).length} accessible PDF{(tier.fileIds || []).length === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="status-line">Add tiers first.</p>
              )}
              <div className="delivery-inline-actions">
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => handleSendEmails()}
                  disabled={!detail.backers.length || !detail.files.length}
                >
                  Send Unsent Emails
                </button>
                {confirmState?.key === "resend-all" ? (
                  <>
                    <span className="delivery-confirm-label">{confirmState.label}</span>
                    <button
                      className="button-secondary delivery-confirm-yes"
                      type="button"
                      onClick={() => { setConfirmState(null); void handleSendEmails({ resendAll: true }); }}
                    >
                      Yes, resend
                    </button>
                    <button className="button-secondary" type="button" onClick={() => setConfirmState(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setConfirmState({ key: "resend-all", label: "Resend to every backer, including already-emailed?" })}
                    disabled={!detail.backers.length || !detail.files.length}
                  >
                    Resend All
                  </button>
                )}
              </div>
              <p className="status-line">
                Each backer gets one private campaign link filtered by their tier. By default, only backers who have not been emailed yet will be sent.
              </p>
              {sendStatus ? <p className={statusClass(sendStatus)}>{sendStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Assets</h2>
              </div>
              <div className="delivery-upload-grid">
                <div className="delivery-upload-card">
                  <span className="delivery-upload-card__label">Cover image</span>
                  {coverUrl ? (
                    <>
                      <img className="delivery-cover-preview" src={coverUrl} alt={`${detail.project.title} cover`} />
                      <p className="delivery-upload-card__meta">{detail.currentCover.originalFilename}</p>
                    </>
                  ) : (
                    <p className="delivery-upload-card__empty">No cover uploaded yet.</p>
                  )}
                  <form onSubmit={(event) => handleUpload("cover", event)}>
                    <label className={`button-secondary button-compact delivery-upload-button${isUploading ? " is-disabled" : ""}`}>
                      <span>{coverUrl ? "Replace Image" : "Upload Image"}</span>
                      <input
                        className="delivery-upload-input"
                        name="file"
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            event.target.form?.requestSubmit();
                          }
                        }}
                      />
                    </label>
                  </form>
                </div>

                <div className="delivery-upload-card">
                  <span className="delivery-upload-card__label">PDF library</span>
                  <p className="delivery-upload-card__meta">
                    {detail.files.length} PDF{detail.files.length === 1 ? "" : "s"} uploaded
                  </p>
                  <form onSubmit={(event) => handleUpload("pdf", event)}>
                    <label className={`button-primary button-compact delivery-upload-button${isUploading ? " is-disabled" : ""}`}>
                      <span>Upload PDF</span>
                      <input
                        className="delivery-upload-input"
                        name="file"
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={isUploading}
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            event.target.form?.requestSubmit();
                          }
                        }}
                      />
                    </label>
                  </form>
                </div>
              </div>
              {detail.files.length ? (
                <div className="delivery-mini-list">
                  {detail.files.map((file) => {
                    const fileConfirmKey = `delete-file-${file.id}`;
                    return (
                      <div key={file.id} className="delivery-mini-list__item">
                        <div className="delivery-mini-list__item-header">
                          <strong>{file.originalFilename}</strong>
                          {confirmState?.key === fileConfirmKey ? (
                            <span className="delivery-confirm-inline">
                              <span className="delivery-confirm-label">{confirmState.label}</span>
                              <button className="button-secondary button-compact delivery-confirm-yes" type="button" onClick={() => handleDeleteFile(file)}>
                                Yes
                              </button>
                              <button className="button-secondary button-compact" type="button" onClick={() => setConfirmState(null)}>
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              className="button-secondary button-compact"
                              type="button"
                              onClick={() => setConfirmState({ key: fileConfirmKey, label: `Delete ${file.originalFilename}?` })}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <div className="delivery-pdf-frame">
                          <InlinePdfReader
                            pdfUrl={fileRoute(file.id) + "/content"}
                            pages={file.readerPages || []}
                            compact
                          />
                        </div>
                        <span>
                          v{file.versionNumber} | {formatFileSize(file.fileSizeBytes)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {assetStatus ? <p className={statusClass(assetStatus)}>{assetStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Analytics</h2>
              </div>
              {analyticsTotals ? (
                <>
                  <div className="delivery-inline-stats delivery-analytics-stats">
                    <div>
                      <span>Unique Openers</span>
                      <strong>
                        {analyticsTotals.uniqueOpeners} / {analyticsTotals.backerCount}
                      </strong>
                      <small>{formatRate(analyticsTotals.uniqueOpeners, analyticsTotals.backerCount)} opened</small>
                    </div>
                    <div>
                      <span>Total Page Views</span>
                      <strong>{analyticsTotals.totalPageViews}</strong>
                      <small>{analytics.windowDays} day trend</small>
                    </div>
                    <div>
                      <span>Unique Downloaders</span>
                      <strong>{analyticsTotals.uniqueDownloaders}</strong>
                      <small>{formatRate(analyticsTotals.uniqueDownloaders, analyticsTotals.backerCount)} downloaded</small>
                    </div>
                    <div>
                      <span>Total Downloads</span>
                      <strong>{analyticsTotals.totalDownloads}</strong>
                      <small>{analyticsTotals.unopenedBackers} still unopened</small>
                    </div>
                  </div>

                  <div className="delivery-analytics-card">
                    <div className="delivery-mini-list__item-header">
                      <strong>Page Views Over Time</strong>
                      <span>Last {analytics.windowDays} days</span>
                    </div>
                    <div className="delivery-analytics-legend">
                      <span><i className="delivery-analytics-swatch delivery-analytics-swatch--views" /> Views</span>
                      <span><i className="delivery-analytics-swatch delivery-analytics-swatch--downloads" /> Downloads</span>
                    </div>
                    <div className="delivery-analytics-trend">
                      {analyticsTimeline.map((day) => (
                        <div key={day.date} className="delivery-analytics-trend__row">
                          <span className="delivery-analytics-trend__label">{day.label}</span>
                          <div className="delivery-analytics-trend__bars">
                            <div
                              className="delivery-analytics-trend__bar delivery-analytics-trend__bar--views"
                              style={{
                                width: `${analyticsMaxCount ? (day.pageViews / analyticsMaxCount) * 100 : 0}%`,
                              }}
                            />
                            <div
                              className="delivery-analytics-trend__bar delivery-analytics-trend__bar--downloads"
                              style={{
                                width: `${analyticsMaxCount ? (day.downloads / analyticsMaxCount) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <strong>{day.pageViews}</strong>
                          <span>{day.downloads}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="status-line">
                    Backer-level activity lives in the backer list, where each person can be opened directly from their row.
                  </p>
                </>
              ) : analyticsStatus ? (
                <p className="status-line">{analyticsStatus}</p>
              ) : (
                <p className="status-line">Analytics will appear after this campaign has activity.</p>
              )}
            </section>

            <section className="editor-card delivery-summary-card">
              <div className="delivery-section__header">
                <h2>Backers</h2>
              </div>
              <p className="delivery-summary-card__subtle">{detail.backers.length} total</p>
              {detail.backers.length ? (
                <div className="delivery-tier-groups" ref={backersListRef}>
                  {tierGroups.map((tier) => {
                    const isExpanded = expandedTierIds.includes(tier.id);
                    const isDropTarget = dragOverTierId === tier.id;
                    const tierBackerIds = tier.backers.map((backer) => backer.id);
                    const tierSelectionCount = tierBackerIds.filter((id) => selectedBackerIds.includes(id)).length;
                    const allTierSelected = Boolean(tierBackerIds.length) && tierSelectionCount === tierBackerIds.length;
                    return (
                      <section
                        key={tier.id}
                        className={`delivery-tier-group${isDropTarget ? " delivery-tier-group--drop" : ""}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (draggedBackerIds.length && tier.isPersisted) {
                            setDragOverTierId(tier.id);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverTierId === tier.id) {
                            setDragOverTierId("");
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!tier.isPersisted) {
                            setDraggedBackerIds([]);
                            setDragOverTierId("");
                            return;
                          }
                          const droppedBacker = detail.backers.find((backer) => draggedBackerIds.includes(backer.id));
                          void handleDropBackers(droppedBacker, tier.id);
                        }}
                      >
                        <div className="delivery-tier-group__toggle">
                          <button
                            className="delivery-tier-group__summary"
                            type="button"
                            onClick={() => toggleTierExpanded(tier.id)}
                          >
                            <span className={`delivery-tier-group__caret${isExpanded ? " is-open" : ""}`}>▾</span>
                            <span className="delivery-tier-group__title">{tier.name}</span>
                            <span className="delivery-tier-group__count">
                              {tier.backers.length} backer{tier.backers.length === 1 ? "" : "s"}
                            </span>
                          </button>
                          <button
                            className="delivery-tier-group__select"
                            type="button"
                            onClick={() => toggleTierSelection(tier.id)}
                            disabled={!tier.backers.length}
                          >
                            {allTierSelected ? "Clear" : "Select all"}
                          </button>
                        </div>
                        {isExpanded ? (
                          <div className="delivery-tier-group__list">
                            {tier.backers.length ? (
                              tier.backers.map((backer) => {
                                const isEditing = editingBackerId === backer.id;
                                const availableMoveTargets = detail.tiers.filter((entry) => entry.id !== backer.tierId);
                                const isSelected = selectedBackerIds.includes(backer.id);
                                return (
                                  <article
                                    key={backer.id}
                                    className={`delivery-backer-row${isSelected ? " is-selected" : ""}`}
                                    onClick={(event) => {
                                      if (isEditing) {
                                        return;
                                      }
                                      handleBackerSelection(backer.id, event);
                                    }}
                                  >
                                    <div className="delivery-backer-row__lead">
                                      <button
                                        className="delivery-backer-row__grab"
                                        type="button"
                                        disabled={!availableMoveTargets.length}
                                        draggable
                                        onMouseDown={(event) => event.stopPropagation()}
                                        onDragStart={(event) => handleBackerDragStart(backer, event)}
                                        onDragEnd={handleBackerDragEnd}
                                        aria-label={`Drag ${backer.email} to another tier`}
                                        title={
                                          availableMoveTargets.length
                                            ? isSelected && selectedCount > 1
                                              ? `Drag ${selectedCount} selected backers`
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
                                          value={backerDraft.email}
                                          onChange={(event) =>
                                            setBackerDraft((current) => ({ ...current, email: event.target.value }))
                                          }
                                          onClick={(event) => event.stopPropagation()}
                                          aria-label="Backer email"
                                        />
                                        <select
                                          value={backerDraft.tierId}
                                          onChange={(event) =>
                                            setBackerDraft((current) => ({ ...current, tierId: event.target.value }))
                                          }
                                          onClick={(event) => event.stopPropagation()}
                                          aria-label="Backer tier"
                                        >
                                          {assignableTiers.map((entry) => (
                                            <option key={entry.id} value={entry.id}>
                                              {entry.name}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="delivery-backer-row__edit-actions">
                                          <button className="button-primary button-compact" type="button" onClick={(event) => {
                                            event.stopPropagation();
                                            void handleSaveBacker(backer.id);
                                          }}>
                                            Save
                                          </button>
                                          <button className="button-secondary button-compact" type="button" onClick={(event) => {
                                            event.stopPropagation();
                                            setEditingBackerId("");
                                          }}>
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
                                          <button className="delivery-icon-button" type="button" onClick={(event) => {
                                            event.stopPropagation();
                                            startEditingBacker(backer);
                                          }} aria-label={`Edit ${backer.email}`}>
                                            <PencilIcon />
                                          </button>
                                          <button
                                            className={`delivery-icon-button${confirmState?.key === `backer-${backer.id}` ? " delivery-icon-button--confirming" : ""}`}
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void handleDeleteBacker(backer);
                                            }}
                                            aria-label={confirmState?.key === `backer-${backer.id}` ? `Confirm delete ${backer.email}` : `Delete ${backer.email}`}
                                            title={confirmState?.key === `backer-${backer.id}` ? "Click again to confirm delete" : "Delete"}
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
                              })
                            ) : (
                              <p className="status-line">No backers in this tier yet.</p>
                            )}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <p className="status-line">Import backers and they will appear here for reassignment.</p>
              )}
              {backerStatus ? <p className={statusClass(backerStatus)}>{backerStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Tiers</h2>
              </div>
              <p className="status-line">
                Each tier can override the campaign message, choose its PDFs, import its own backers, and preview the exact private page it will send.
              </p>
              <div className="delivery-mini-list">
                {tiersDraft.map((tier, index) => {
                  const previewBacker = detail.backers.find((backer) => backer.tierId === tier.id);
                  const tierImportText = tierImportTexts[tier.id] || "";
                  const tierImportStatus = tierImportStatuses[tier.id] || "";
                  return (
                    <div key={tier.id} className="delivery-mini-list__item delivery-tier-editor">
                      <div className="delivery-mini-list__item-header">
                        <strong>Tier {index + 1}</strong>
                        <button
                          className="button-secondary button-compact"
                          type="button"
                          onClick={() => removeTier(index)}
                          disabled={tiersDraft.length <= 1 || tier.backerCount > 0}
                        >
                          Remove
                        </button>
                      </div>
                      <label>
                        <span>Name</span>
                        <input
                          value={tier.name}
                          onChange={(event) => handleTierChange(index, "name", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Tier-specific message override</span>
                        <textarea
                          rows={3}
                          value={tier.messageOverride}
                          onChange={(event) =>
                            handleTierChange(index, "messageOverride", event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>Additional link label</span>
                        <input
                          value={tier.additionalLinkLabel || ""}
                          onChange={(event) =>
                            handleTierChange(index, "additionalLinkLabel", event.target.value)
                          }
                          placeholder="Leave a Letter"
                        />
                      </label>
                      <label>
                        <span>Additional link URL</span>
                        <input
                          value={tier.additionalLinkUrl || ""}
                          onChange={(event) =>
                            handleTierChange(index, "additionalLinkUrl", event.target.value)
                          }
                          placeholder="https://example.com"
                        />
                      </label>
                      <div className="delivery-mini-list">
                        {detail.files.map((file) => (
                          <label key={file.id} className="workspace-toggle">
                            <input
                              type="checkbox"
                              checked={tier.fileIds.includes(file.id)}
                              onChange={() => toggleTierFile(index, file.id)}
                            />
                            <span>{file.originalFilename}</span>
                          </label>
                        ))}
                      </div>
                      <span>{tier.backerCount || 0} backer{tier.backerCount === 1 ? "" : "s"} in this tier</span>

                      <div className="delivery-tier-editor__subsection">
                        <strong>Import Backers</strong>
                        <span>Paste one email per line. These backers will be added directly to {tier.name || `Tier ${index + 1}`}.</span>
                        <textarea
                          rows={6}
                          value={tierImportText}
                          onChange={(event) =>
                            setTierImportTexts((current) => ({
                              ...current,
                              [tier.id]: event.target.value,
                            }))
                          }
                          placeholder={"reader@example.com\ncollector@example.com"}
                        />
                        <div className="delivery-inline-actions">
                          <button
                            className="button-primary button-compact"
                            type="button"
                            onClick={() => handleImportBackersToTier(tier)}
                          >
                            Import Into Tier
                          </button>
                        </div>
                        {tierImportStatus ? <p className={statusClass(tierImportStatus)}>{tierImportStatus}</p> : null}
                      </div>

                      <div className="delivery-tier-editor__subsection">
                        <strong>Preview</strong>
                        <span>{tier.messageOverride || detail.project.shortMessage || "Uses default message."}</span>
                        {tier.additionalLinkUrl ? (
                          <span>{tier.additionalLinkLabel || tier.additionalLinkUrl}</span>
                        ) : null}
                        <div className="delivery-inline-actions">
                          {previewBacker ? (
                            <a className="button-secondary button-compact" href={`/a/${previewBacker.accessToken}`} target="_blank" rel="noreferrer">
                              Open Preview
                            </a>
                          ) : (
                            <span>Add one backer to preview this tier.</span>
                          )}
                          <button
                            className="button-secondary button-compact"
                            type="button"
                            onClick={() => {
                              const { html } = buildDeliveryEmail({
                                projectTitle: detail.project.title,
                                creatorName: detail.project.creatorName,
                                accessUrl: previewBacker
                                  ? `${window.location.origin}/a/${previewBacker.accessToken}`
                                  : `${window.location.origin}/a/preview`,
                                coverImageUrl: coverUrl,
                              });
                              const blob = new Blob([html], { type: "text/html" });
                              const url = URL.createObjectURL(blob);
                              window.open(url, "_blank");
                              setTimeout(() => URL.revokeObjectURL(url), 60000);
                            }}
                          >
                            Preview Email
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="delivery-inline-actions">
                <button className="button-secondary" type="button" onClick={addTier}>
                  Add Tier
                </button>
                <button className="button-primary" type="button" onClick={handleSaveConfig}>
                  Save All Changes
                </button>
              </div>
            </section>
        </div>
      ) : null}

      {summary?.storage ? (
        <p className="status-line delivery-footer-note">
          Storage: {summary.storage.database}. Uploads:{" "}
          {summary.storage.uploadsConfigured ? "bucket ready" : "not configured"}.
        </p>
      ) : null}
    </section>
  );
}
