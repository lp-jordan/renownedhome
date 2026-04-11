async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const error = await response.json();
      message = error.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    if (typeof onProgress === "function") {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      };
    }

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload?.error || xhr.statusText || "Upload failed"));
    };

    xhr.send(formData);
  });
}

export const api = {
  getBootstrap() {
    return request("/api/bootstrap");
  },
  getSession() {
    return request("/api/auth/session");
  },
  login(payload) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  logout() {
    return request("/api/auth/logout", {
      method: "POST",
    });
  },
  submitLetter(payload) {
    return request("/api/public/letters", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getAdminData() {
    return request("/api/admin/data");
  },
  getAdminLetters() {
    return request("/api/admin/letters");
  },
  saveSiteSettings(siteSettings) {
    return request("/api/admin/site-settings", {
      method: "PUT",
      body: JSON.stringify({ siteSettings }),
    });
  },
  savePage(page) {
    return request(`/api/admin/pages/${encodeURIComponent(page.id)}`, {
      method: "PUT",
      body: JSON.stringify({ page }),
    });
  },
  saveIssue(issue) {
    return request(`/api/admin/issues/${encodeURIComponent(issue.id)}`, {
      method: "PUT",
      body: JSON.stringify({ issue }),
    });
  },
  saveTeamMember(teamMember) {
    return request(
      `/api/admin/team-members/${encodeURIComponent(teamMember.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ teamMember }),
      }
    );
  },
  saveSocialLink(socialLink) {
    return request(
      `/api/admin/social-links/${encodeURIComponent(socialLink.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ socialLink }),
      }
    );
  },
  saveRedirect(redirect) {
    return request(`/api/admin/redirects/${encodeURIComponent(redirect.id)}`, {
      method: "PUT",
      body: JSON.stringify({ redirect }),
    });
  },
  deleteRedirect(redirectId) {
    return request(`/api/admin/redirects/${encodeURIComponent(redirectId)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
  },
  saveLetter(letter) {
    return request(`/api/admin/letters/${encodeURIComponent(letter.id)}`, {
      method: "PUT",
      body: JSON.stringify({ letter }),
    });
  },
  saveAsset(asset) {
    return request(`/api/admin/assets/${encodeURIComponent(asset.id)}`, {
      method: "PUT",
      body: JSON.stringify({ asset }),
    });
  },
  deleteAsset(assetId) {
    return request(`/api/admin/assets/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
  },
  createAssetVariant(assetId, variant) {
    return request(`/api/admin/assets/${encodeURIComponent(assetId)}/variants`, {
      method: "POST",
      body: JSON.stringify({ variant }),
    });
  },
  updateAssetVariant(assetId, variantId, variant) {
    return request(
      `/api/admin/assets/${encodeURIComponent(assetId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ variant }),
      }
    );
  },
  deleteAssetVariant(assetId, variantId) {
    return request(
      `/api/admin/assets/${encodeURIComponent(assetId)}/variants/${encodeURIComponent(variantId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({}),
      }
    );
  },
  getDeliverySummary() {
    return request("/api/admin/delivery/summary");
  },
  getDeliveryProjects() {
    return request("/api/admin/delivery/projects");
  },
  getDeliveryProject(projectId) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}`);
  },
  getDeliveryAnalytics(projectId, days = 14) {
    return request(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/analytics?days=${encodeURIComponent(days)}`
    );
  },
  createDeliveryProject(payload) {
    return request("/api/admin/delivery/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateDeliveryProject(projectId, payload) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteDeliveryProject(projectId) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
  },
  previewDeliveryImport(csvText) {
    return request("/api/admin/delivery/import-preview", {
      method: "POST",
      body: JSON.stringify({ csvText }),
    });
  },
  importDeliveryBackers(projectId, csvText) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}/import-backers`, {
      method: "POST",
      body: JSON.stringify({ csvText }),
    });
  },
  updateDeliveryBacker(projectId, backer) {
    return request(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/backers/${encodeURIComponent(backer.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({ backer }),
      }
    );
  },
  moveDeliveryBackers(projectId, backerIds, tierId) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}/backers/move`, {
      method: "POST",
      body: JSON.stringify({ backerIds, tierId }),
    });
  },
  deleteDeliveryBacker(projectId, backerId) {
    return request(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/backers/${encodeURIComponent(backerId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({}),
      }
    );
  },
  sendDeliveryEmails(projectId, options = {}) {
    return request(`/api/admin/delivery/projects/${encodeURIComponent(projectId)}/send-emails`, {
      method: "POST",
      body: JSON.stringify(options),
    });
  },
  async uploadDeliveryCover(projectId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/upload-cover`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Cover upload failed");
    }
    return response.json();
  },
  async uploadDeliveryPdf(projectId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/upload-pdf`,
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "PDF upload failed");
    }
    return response.json();
  },
  deleteDeliveryFile(projectId, fileId) {
    return request(
      `/api/admin/delivery/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE",
        body: JSON.stringify({}),
      }
    );
  },
  getDeliveryAccess(token) {
    return request(`/api/delivery/access/${encodeURIComponent(token)}`, {
      headers: {},
    });
  },
  async uploadAssets({ files, onProgress }) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    return uploadWithProgress("/api/admin/assets/upload", formData, onProgress);
  },
  async uploadAsset(payload) {
    return api.uploadAssets({
      files: [payload.file],
    });
  },
};
