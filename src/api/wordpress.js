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
    const data = await res.json();
    logSuccess('Fetched media', { count: data.length });
    return data;
  } catch (err) {
    logError('Error fetching media', err);
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
    const data = await res.json();
    logSuccess('Uploaded media', data);
    return data;
  } catch (err) {
    logError('Error uploading media', err);
    throw err;
  }
}
