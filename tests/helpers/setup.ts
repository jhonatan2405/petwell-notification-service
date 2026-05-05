// ============================================================
// Setup global de variables de entorno para todos los tests
// Se ejecuta ANTES de cargar cualquier módulo del servicio
// ============================================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-petwell-jwt-2024';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-fake';
process.env.USER_SERVICE_URL = 'http://localhost:3001';
process.env.PORT = '3099';
