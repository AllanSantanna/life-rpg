import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const app = createApp('http://localhost:5173');
describe('Infraestrutura HTTP', () => {
  it('responde ao health check sem depender do banco', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it('responde em JSON para rotas ausentes', async () => {
    const response = await request(app).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Rota não encontrada.' });
  });
  it('rejeita JSON malformado', async () => {
    const response = await request(app)
      .post('/missing')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
  });
});
