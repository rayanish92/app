const QUEUE_KEY = 'offline_sync_queue';

export const getQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
};

export const addToQueue = (operation) => {
  const queue = getQueue();
  queue.push({
    ...operation,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString()
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue.length;
};

export const removeFromQueue = (id) => {
  const queue = getQueue().filter(op => op.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const clearQueue = () => {
  localStorage.setItem(QUEUE_KEY, '[]');
};

export const syncQueue = async (axios, API_URL) => {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const op of queue) {
    try {
      const config = { withCredentials: true };
      if (op.method === 'POST') {
        await axios.post(`${API_URL}${op.url}`, op.data, config);
      } else if (op.method === 'PUT') {
        await axios.put(`${API_URL}${op.url}`, op.data, config);
      } else if (op.method === 'DELETE') {
        await axios.delete(`${API_URL}${op.url}`, config);
      }
      removeFromQueue(op.id);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
};
