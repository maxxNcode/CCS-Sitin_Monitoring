require('dotenv').config();
const { createClient } = require('@libsql/client');

let client = null;
let initialized = false;
let initPromise = null;

// Initialize connection
const initDb = async () => {
  if (initialized) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('Initializing Turso connection...');
      client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });

      // Test connection with a simple query
      await client.execute('SELECT 1');

      console.log('✓ Connected to Turso database');
      initialized = true;
      return client;
    } catch (err) {
      console.error('Failed to connect to Turso:', err.message);
      initPromise = null; // Reset on failure to allow retry
      throw err;
    }
  })();

  return initPromise;
};

// Execute query helper
const executeQuery = async (sql, params = []) => {
  if (!initialized) {
    await initDb();
  }
  return await client.execute({ sql, args: params });
};

// Wrapper for db.run() - maintains callback API
const run = function(sql, ...args) {
  let params = [];
  let callback = null;

  if (args.length > 0) {
    if (typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    } else if (args.length > 0) {
      params = args;
    }
  }

  (async () => {
    try {
      const result = await executeQuery(sql, params);
      if (callback) {
        const lastID = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
        callback.call({ changes: result.rowsAffected, lastID }, null);
      }
    } catch (err) {
      if (callback) callback(err);
    }
  })();
};

// Wrapper for db.get() - maintains callback API
const get = function(sql, ...args) {
  let params = [];
  let callback = null;

  if (args.length > 0) {
    if (typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    } else if (args.length > 0) {
      params = args;
    }
  }

  (async () => {
    try {
      const result = await executeQuery(sql, params);
      const row = result.rows?.[0] || null;
      if (callback) {
        const lastID = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
        callback.call({ changes: result.rowsAffected, lastID }, null, row);
      }
    } catch (err) {
      if (callback) callback(err);
    }
  })();
};

// Wrapper for db.all() - maintains callback API
const all = function(sql, ...args) {
  let params = [];
  let callback = null;

  if (args.length > 0) {
    if (typeof args[args.length - 1] === 'function') {
      callback = args.pop();
    }
    if (args.length === 1 && Array.isArray(args[0])) {
      params = args[0];
    } else if (args.length > 0) {
      params = args;
    }
  }

  (async () => {
    try {
      const result = await executeQuery(sql, params);
      const rows = result.rows || [];
      if (callback) {
        const lastID = result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined;
        callback.call({ changes: result.rowsAffected, lastID }, null, rows);
      }
    } catch (err) {
      if (callback) callback(err);
    }
  })();
};

// Wrapper for db.serialize() - for transactions
const serialize = function(callback) {
  if (callback) callback();
};

// Execute raw SQL
const exec = async (sql) => {
  try {
    await executeQuery(sql);
  } catch (err) {
    console.error('Exec error:', err.message);
    throw err;
  }
};

// Prepare statement
const prepare = function(sql) {
  return {
    run: function(...args) {
      let params = [];
      let callback = null;
      
      if (args.length > 0) {
        if (typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        if (args.length === 1 && Array.isArray(args[0])) {
          params = args[0];
        } else {
          params = args;
        }
      }
      run(sql, params, callback);
    },
    finalize: function(callback) {
      if (callback) callback();
    },
  };
};

module.exports = {
  initDb,
  run,
  get,
  all,
  serialize,
  exec,
  prepare,
};
