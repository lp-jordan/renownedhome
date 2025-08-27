import { logRequest, logSuccess, logError } from '../utils/logger';

const baseUrl = import.meta.env.VITE_SUPABASE_URL;
const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchIssues() {
  const endpoint = `${baseUrl}/rest/v1/issues?select=*`;
  logRequest('Fetching issues from Supabase', endpoint);
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      logError('Failed to fetch issues from Supabase', `${res.status} ${res.statusText}`);
      throw new Error('Failed to fetch issues');
    }
    const data = await res.json();
    logSuccess('Fetched issues from Supabase', { count: data.length });
    return data;
  } catch (err) {
    logError('Error fetching issues from Supabase', err);
    throw err;
  }
}
