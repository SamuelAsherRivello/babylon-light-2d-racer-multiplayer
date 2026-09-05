import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { RaceRoom } from './RaceRoom';

export function createGameServer() {
  const server=new Server({greet:false,gracefullyShutdown:false,transport:new WebSocketTransport({maxPayload:4096,pingInterval:3000,pingMaxRetries:2}),express:app=>{
    app.disable('x-powered-by');
    app.get('/health',(_req,res)=>res.json({ok:true,game:'2D Racer Multiplayer'}));
    app.use(express.static(fileURLToPath(new URL('../dist',import.meta.url)),{index:'index.html'}));
  }});
  server.define('race',RaceRoom);
  return server;
}
