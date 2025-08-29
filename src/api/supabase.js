import { createClient } from '@supabase/supabase-js';
import { logRequest, logSuccess, logError } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV) {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase anon key (first 6 chars):', supabaseAnonKey?.slice(0, 6));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchIssues() {
  logRequest('Fetching issues from Supabase');
  try {
    const { data, error } = await supabase.from('issues').select('*');
    if (error) {
      logError('Error fetching issues from Supabase', error);
      throw error;
    }
    logSuccess('Fetched issues from Supabase', { count: data?.length ?? 0 });
    return data ?? [];
  } catch (err) {
    logError('Unexpected error fetching issues', err);
    throw err;
  }
}

export async function fetchHomePanels() {
  logRequest('Fetching home panels from Supabase');
  try {
    const { data, error } = await supabase.from('home_panels').select('*');
    if (error) {
      logError('Error fetching home panels', error);
      throw error;
    }
    logSuccess('Fetched home panels', { count: data?.length ?? 0 });
    return data ?? [];
  } catch (err) {
    logError('Unexpected error fetching home panels', err);
    throw err;
  }
}

export async function fetchPageSubtitle(id) {
  logRequest('Fetching page subtitle from Supabase', { id });
  try {
    const { data, error } = await supabase
      .from('page_subtitles')
      .select('page_title, headline_content')
      .eq('id', id)
      .single();
    if (error) {
      logError('Error fetching page subtitle', error);
      throw error;
    }
    logSuccess('Fetched page subtitle', { id });
    return data ?? {};
  } catch (err) {
    logError('Unexpected error fetching page subtitle', err);
    throw err;
  }
}

export async function fetchMediaList() {
  logRequest('Fetching media list from Supabase');
  try {
    const { data, error } = await supabase.from('media').select('*');
    if (error) {
      logError('Error fetching media list', error);
      throw error;
    }
    logSuccess('Fetched media list', { count: data?.length ?? 0 });
    return data ?? [];
  } catch (err) {
    logError('Unexpected error fetching media list', err);
    throw err;
  }
}

export async function uploadMedia(file) {
  const filePath = `${Date.now()}-${file.name}`;
  logRequest('Uploading media to Supabase Storage', filePath);

  try {
    const { data, error } = await supabase.storage.from('media').upload(filePath, file);

    if (error) {
      logError('Error uploading media', error);
      throw error;
    }

    const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);

    logSuccess('Uploaded media', { path: data.path, url: urlData.publicUrl });
    return { path: data.path, publicUrl: urlData.publicUrl };
  } catch (err) {
    logError('Unexpected error uploading media', err);
    throw err;
  }
}