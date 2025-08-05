// config/database.js - Configuración de PostgreSQL
const { Pool } = require('pg');

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoice_management',
  user: process.env.DB_USER || 'invoice_user',
  password: process.env.DB_PASSWORD || 'password123',
  
  // Configuración del pool de conexiones
  max: 20, // máximo número de conexiones en el pool
  idleTimeoutMillis: 30000, // tiempo antes de cerrar conexión inactiva
  connectionTimeoutMillis: 2000, // tiempo máximo para conectar
  
  // SSL para producción
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Event listeners para debugging
pool.on('connect', (client) => {
  console.log('🔗 Nueva conexión PostgreSQL establecida');
});

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en cliente PostgreSQL:', err);
  process.exit(-1);
});

// Función para ejecutar queries con manejo de errores
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    console.log('📊 Query ejecutada:', {
      text: text.substring(0, 50) + '...',
      duration: `${duration}ms`,
      rows: res.rowCount
    });
    
    return res;
  } catch (error) {
    console.error('❌ Error en query:', {
      text: text.substring(0, 50) + '...',
      error: error.message,
      params
    });
    throw error;
  }
};

// Función para transacciones
const transaction = async (callback) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Test de conexión
const testConnection = async () => {
  try {
    const res = await query('SELECT NOW() as current_time, version()');
    console.log('✅ Conexión a PostgreSQL exitosa:', {
      time: res.rows[0].current_time,
      version: res.rows[0].version.split(' ')[0]
    });
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    return false;
  }
};

// Inicializar conexión al importar
testConnection();

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};