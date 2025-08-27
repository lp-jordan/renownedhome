import { logRequest, logSuccess, logError } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchHomePanels() {
  const endpoint = `${supabaseUrl}/rest/v1/home_panels?select=label,image_url`;
  logRequest('Fetching home panels from Supabase', endpoint);
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      logError('Failed to fetch home panels from Supabase', `${res.status} ${res.statusText}`);
      throw new Error('Failed to fetch home panels');
    }
    const data = await res.json();
    logSuccess('Fetched home panels from Supabase', { count: data.length });
    return data;
  } catch (err) {
    logError('Error fetching home panels from Supabase', err);
    throw err;
  }
}
