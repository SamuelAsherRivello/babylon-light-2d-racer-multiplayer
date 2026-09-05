import { createGameServer } from './app';
const port=Number(process.env.PORT ?? 2567);
const host=process.env.HOST ?? '127.0.0.1';
const server=createGameServer();
await server.listen(port,host);
console.log(`2D Racer multiplayer: http://${host}:${port} (game + Colyseus server)`);
for(const signal of ['SIGINT','SIGTERM'] as const) process.once(signal,()=>{void server.gracefullyShutdown(false).then(()=>process.exit(0));});
