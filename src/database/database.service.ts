import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const connectionString = this.configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    console.log('🔗 Connecting to database...');
    console.log('📍 Host:', this.extractHost(connectionString));

    this.pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Required for Neon
      },
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 10000, // 10 seconds (increased from default 2s)
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');

      // Test query
      const result = await client.query('SELECT NOW()');
      console.log('🕐 Database time:', result.rows[0].now);

      client.release();
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('📋 Details:', {
        code: error.code,
        host: this.extractHost(connectionString),
      });
      throw error;
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('❌ Unexpected database error:', err);
    });
  }

  async onModuleDestroy() {
    await this.pool.end();
    console.log('👋 Database pool closed');
  }

  private extractHost(connectionString: string): string {
    try {
      const url = new URL(connectionString);
      return url.host;
    } catch {
      return 'unknown';
    }
  }

  // Execute query
  async query(sql: string, params?: any[]): Promise<any[]> {
    const result: QueryResult = await this.pool.query(sql, params);
    return result.rows;
  }

  // Get single row
  async queryOne(sql: string, params?: any[]): Promise<any> {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  }

  // Execute and return result metadata
  async execute(sql: string, params?: any[]): Promise<QueryResult> {
    return await this.pool.query(sql, params);
  }

  // Get connection for transactions
  async getClient() {
    return await this.pool.connect();
  }
}
