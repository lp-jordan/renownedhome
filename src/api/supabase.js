import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchIssues() {
  const { data, error } = await supabase
    .from('issues')
    .select('label, image_url');
  if (error) throw error;
  return data ?? [];
}

export async function fetchHomePanels() {
  const { data, error } = await supabase
    .from('home_panels')
    .select('label, image_url');
  if (error) throw error;
  return data ?? [];
}

export async function fetchMediaList() {
  const { data, error } = await supabase
    .from('media')
    .select('label, image_url');
  if (error) throw error;
  return data ?? [];
}

export async function uploadMedia(file) {
  const filePath = `${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('media')
    .upload(filePath, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('media')
    .getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData.publicUrl };
}
