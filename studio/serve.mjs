#!/usr/bin/env node
import {createStudioServer} from './server.mjs';
const port=process.env.MOTIONFORGE_PORT?Number(process.env.MOTIONFORGE_PORT):4177;
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('MOTIONFORGE_PORT must be 1024–65535');
const app=createStudioServer({port});await app.listen();
console.log(`\n  MotionForge Studio → http://127.0.0.1:${port}\n  Local only · credentials stay in this process\n  Ctrl+C to stop\n`);
