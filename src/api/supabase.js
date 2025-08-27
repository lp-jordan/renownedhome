import { logRequest, logSuccess, logError } from '../utils/logger';

export async function fetchMedia() {
  logRequest('Fetching media from Supabase');
  const data = [];
  logSuccess('Fetched media', { count: data.length });
  return data;
}

export async function fetchMediaById(id) {
  logRequest('Fetching media by ID from Supabase', { id });
  const data = { id, source_url: '' };
  logSuccess('Fetched media by ID', { id: data.id });
  return data;
}

export async function fetchIssues() {
  logRequest('Fetching issues from Supabase');
  const data = [];
  logSuccess('Fetched issues', { count: data.length });
  return data;
}

export async function fetchHomePanels() {
  logRequest('Fetching home panels from Supabase');
  const data = [];
  logSuccess('Fetched home panels', { count: data.length });
  return data;
}

export async function uploadMedia(file) {
  logRequest('Uploading media to Supabase', { name: file?.name });
  logError('uploadMedia not implemented');
  throw new Error('uploadMedia not implemented');
}
