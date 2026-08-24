function normalizeError(error) {
  if (!error) return null;
  if (typeof error === 'string') return { message: error };
  return { message: error.message || 'Request failed' };
}

class QueryBuilder {
  constructor(table, mode = 'authenticated', state = {}) {
    this.table = table;
    this.mode = mode;
    this.state = state;
    this.operation = 'select';
    this.payload = null;
    this.filters = [];
    this.orderBy = null;
    this.singleRow = false;
    this.columns = '*';
  }

  select(columns = '*') { this.columns = columns; return this; }
  insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
  update(payload) { this.operation = 'update'; this.payload = payload; return this; }
  upsert(payload, options = {}) { this.operation = 'upsert'; this.payload = payload; this.onConflict = options.onConflict || null; return this; }
  delete() { this.operation = 'delete'; return this; }
  eq(column, value) { this.filters.push({ column, operator: 'eq', value }); return this; }
  order(column, options = {}) { this.orderBy = { column, ascending: options.ascending !== false }; return this; }
  single() { this.singleRow = true; return this.execute(); }

  async execute() {
    try {
      const endpoint = this.mode === 'public' ? '/api/public-data' : '/api/data';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          payload: this.payload,
          filters: this.filters,
          orderBy: this.orderBy,
          single: this.singleRow,
          columns: this.columns,
          onConflict: this.onConflict,
          scopeToken: this.state.scopeToken || null,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (body.scopeToken) this.state.scopeToken = body.scopeToken;
      if (!response.ok) return { data: null, error: normalizeError(body.error || body.message || `Request failed (${response.status})`) };
      return { data: body.data ?? null, error: null };
    } catch (error) {
      return { data: null, error: normalizeError(error) };
    }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

function makeStorage(state) {
  return {
    from() {
      return {
        async upload(path, file) {
          try {
            const form = new FormData();
            form.append('file', file);
            const response = await fetch('/api/logo', { method: 'POST', credentials: 'include', body: form });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) return { data: null, error: normalizeError(body.error || body.message) };
            state.storageUrls[path] = body.publicUrl;
            return { data: { path: body.key }, error: null };
          } catch (error) {
            return { data: null, error: normalizeError(error) };
          }
        },
        getPublicUrl(path) {
          return { data: { publicUrl: state.storageUrls[path] || '' } };
        },
      };
    },
  };
}

function makeClient(mode = 'authenticated') {
  const state = { scopeToken: null, storageUrls: {} };
  return {
    from(table) { return new QueryBuilder(table, mode, state); },
    storage: makeStorage(state),
    async rpc(name) {
      try {
        const response = await fetch('/api/rpc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return { data: null, error: normalizeError(body.error || body.message) };
        return { data: body.data ?? null, error: null };
      } catch (error) {
        return { data: null, error: normalizeError(error) };
      }
    },
  };
}

export const supabase = makeClient('authenticated');
export const isSupabaseConfigured = true;

// Transitional helper for public pages. It preserves the old query-builder
// shape but routes requests through token-scoped Netlify Functions, not Supabase.
export function createClient() { return makeClient('public'); }
