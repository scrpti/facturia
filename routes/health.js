// routes/health.js - Health check y status del sistema
const express = require('express');
const { testConnection, query } = require('../config/database');

const router = express.Router();

// GET /api/health - Health check básico
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test de base de datos
    const dbHealthy = await testConnection();
    
    // Métricas básicas del sistema
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const responseTime = Date.now() - startTime;
    
    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      response_time_ms: responseTime,
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      
      services: {
        database: {
          status: dbHealthy ? 'up' : 'down',
          response_time_ms: responseTime
        },
        api: {
          status: 'up',
          port: process.env.PORT || 3001
        }
      },
      
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
      }
    };

    // Status code basado en salud del sistema
    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    console.error('Error en health check:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error.message
    });
  }
});

// GET /api/health/db - Health check detallado de base de datos
router.get('/db', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test básico de conexión
    const connectionTest = await testConnection();
    
    // Test de queries básicas
    const versionResult = await query('SELECT version(), current_database(), current_user');
    const statsResult = await query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    // Estadísticas de tablas principales
    const tableStats = await query(`
      SELECT 
        'invoices' as table_name,
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_rows
      FROM invoices
      UNION ALL
      SELECT 
        'companies' as table_name,
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_rows
      FROM companies
      UNION ALL
      SELECT 
        'suppliers' as table_name,
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_rows
      FROM suppliers
    `);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      status: 'healthy',
      response_time_ms: responseTime,
      connection: connectionTest,
      database_info: {
        version: versionResult.rows[0].version.split(' ')[0],
        database: versionResult.rows[0].current_database,
        user: versionResult.rows[0].current_user
      },
      table_statistics: tableStats.rows,
      activity_stats: statsResult.rows
    });

  } catch (error) {
    console.error('Error en DB health check:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database health check failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/metrics - Métricas del sistema
router.get('/metrics', async (req, res) => {
  try {
    // Estadísticas generales del sistema
    const systemStats = await query(`
      WITH daily_stats AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as daily_invoices,
          SUM(amount) as daily_amount
        FROM invoices 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      ),
      status_breakdown AS (
        SELECT 
          status,
          COUNT(*) as count,
          ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER())::numeric, 2) as percentage
        FROM invoices
        GROUP BY status
      ),
      recent_activity AS (
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d
        FROM invoices
      )
      SELECT 
        json_agg(
          json_build_object(
            'date', ds.date,
            'invoices', ds.daily_invoices,
            'amount', ds.daily_amount
          ) ORDER BY ds.date DESC
        ) as daily_activity,
        
        (SELECT json_agg(
          json_build_object(
            'status', sb.status,
            'count', sb.count,
            'percentage', sb.percentage
          )
        ) FROM status_breakdown sb) as status_distribution,
        
        (SELECT json_build_object(
          'last_hour', ra.last_hour,
          'last_24h', ra.last_24h,
          'last_7d', ra.last_7d
        ) FROM recent_activity ra) as recent_activity
    `);

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      metrics: systemStats.rows[0] || {
        daily_activity: [],
        status_distribution: [],
        recent_activity: { last_hour: 0, last_24h: 0, last_7d: 0 }
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to get system metrics',
      details: error.message
    });
  }
});

module.exports = router;