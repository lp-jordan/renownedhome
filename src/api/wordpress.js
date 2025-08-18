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
  const res = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    headers: {
      ...authHeader(),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch media');
  }
  return res.json();
}

export async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: 'POST',
    headers: {
      ...authHeader(),
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Failed to upload media');
  }
  return res.json();
}

