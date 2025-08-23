import { logRequest, logSuccess, logError } from '../utils/logger';

const baseUrl = import.meta.env.VITE_WP_BASE_URL;
const username = import.meta.env.VITE_WP_USERNAME;
const password = import.meta.env.VITE_WP_APP_PASSWORD;

function authHeader() {
  if (username && password) {
    const token = btoa(`${username}:${password}`);
    return { Authorization: `Basic ${token}` };
  }
  return {};
}

async function ensureJsonResponse(res, action) {
  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    const raw = await res.text();
    logError(`${action} returned non-JSON response`, raw);
    throw new Error(`${action} did not return JSON`);
  }
}

export async function fetchMedia() {
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;
  logRequest('Fetching media', endpoint);
  try {
    const res = await fetch(endpoint, {
      headers: {
        ...authHeader(),
      },
    });
    const authHeaderValue = res.headers.get('WWW-Authenticate');
    if (res.status === 401 || res.status === 403) {
      logError(
        'WordPress authentication failed: missing or invalid credentials',
        { status: res.status, authHeader: authHeaderValue }
      );
    }
    if (!res.ok) {
      logError('Failed to fetch media', `${res.status} ${res.statusText}`);
      throw new Error('Failed to fetch media');
    }
    await ensureJsonResponse(res, 'Fetching media');
    const data = await res.json();
    logSuccess('Fetched media', { count: data.length });
    return data;
  } catch (err) {
    logError('Error fetching media', err);
    throw err;
  }
}

export async function fetchMediaById(id) {
  const endpoint = `${baseUrl}/wp-json/wp/v2/media/${id}`;
  logRequest('Fetching media by ID', endpoint);
  try {
    const res = await fetch(endpoint, {
      headers: {
        ...authHeader(),
      },
    });
    const authHeaderValue = res.headers.get('WWW-Authenticate');
    if (res.status === 401 || res.status === 403) {
      logError(
        'WordPress authentication failed: missing or invalid credentials',
        { status: res.status, authHeader: authHeaderValue }
      );
    }
    if (!res.ok) {
      logError('Failed to fetch media by ID', `${res.status} ${res.statusText}`);
      throw new Error('Failed to fetch media by ID');
    }
    await ensureJsonResponse(res, 'Fetching media by ID');
    const data = await res.json();
    logSuccess('Fetched media by ID', { id: data.id });
    return data;
  } catch (err) {
    logError('Error fetching media by ID', err);
    throw err;
  }
}

export async function fetchIssues() {
  const endpoint = `${baseUrl}/wp-json/wp/v2/issues?_embed`;
  logRequest('Fetching issues with ACF fields', endpoint);
  try {
    const res = await fetch(endpoint, {
      headers: {
        ...authHeader(),
      },
    });
    const authHeaderValue = res.headers.get('WWW-Authenticate');
    if (res.status === 401 || res.status === 403) {
      logError(
        'WordPress authentication failed: missing or invalid credentials',
        { status: res.status, authHeader: authHeaderValue }
      );
    }
    if (!res.ok) {
      logError('Failed to fetch issues', `${res.status} ${res.statusText}`);
      throw new Error('Failed to fetch issues');
    }
    await ensureJsonResponse(res, 'Fetching issues');
    const data = await res.json();
    logSuccess('Fetched issues with ACF fields', { count: data.length });
    return data;
  } catch (err) {
    logError('Error fetching issues', err);
    throw err;
  }
}
export async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = `${baseUrl}/wp-json/wp/v2/media`;
  logRequest('Uploading media', { name: file?.name });

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...authHeader(),
      },
      body: formData,
    });
    const authHeaderValue = res.headers.get('WWW-Authenticate');
    if (res.status === 401 || res.status === 403) {
      logError(
        'WordPress authentication failed: missing or invalid credentials',
        { status: res.status, authHeader: authHeaderValue }
      );
    }
    if (!res.ok) {
      logError('Failed to upload media', `${res.status} ${res.statusText}`);
      throw new Error('Failed to upload media');
    }
    await ensureJsonResponse(res, 'Uploading media');
    const data = await res.json();
    logSuccess('Uploaded media', data);
    return data;
  } catch (err) {
    logError('Error uploading media', err);
    throw err;
  }
}
