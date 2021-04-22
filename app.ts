/*  nodejs-poolController.  An application to control pool equipment.
Copyright (C) 2016, 2017, 2018, 2019, 2020.  Russell Goldin, tagyoureit.  russ.goldin@gmail.com

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
// add source map support for .js to .ts files
require('source-map-support').install();

import { logger } from "./logger/Logger";
import { config } from "./config/Config";
import { conn } from "./controller/comms/Comms";
import { sys, ControllerType } from "./controller/Equipment";

import { state } from "./controller/State";
import { webApp } from "./web/Server";
import * as readline from 'readline';

export async function initAsync() {
    try {
        await config.init();
        await logger.init();
        await conn.init();
        await sys.init();
        await state.init();
        await webApp.init();
        await sys.start();
    } catch (err) { console.log(`Error Initializing nodejs-PoolController ${err.message}`);  }
    //return Promise.resolve()
    //    .then(function () { config.init(); })
    //    .then(function () { logger.init(); })
    //    .then(function () { conn.init(); })
    //    .then(function () { sys.init(); })
    //    .then(function () { state.init(); })
    //    .then(function () { webApp.init(); })
    //    .then(function () { sys.start(); });
}

export async function startPacketCapture(bResetLogs: boolean) {
    try {
        let log = config.getSection('log');
        log.app.captureForReplay = true;
        config.setSection('log', log);
        logger.startCaptureForReplay(bResetLogs);
        if (bResetLogs){
            sys.resetSystem();
        }
    }
    catch (err) {
        console.error(`Error starting replay: ${ err.message }`);
    }
}
export async function stopPacketCaptureAsync() {
    let log = config.getSection('log');
    log.app.captureForReplay = false;
    config.setSection('log', log);
    return logger.stopCaptureForReplayAsync();
}
export async function stopAsync(): Promise<void> {
    try {
        console.log('Shutting down open processes');
        // await sys.board.virtualPumpControllers.stopAsync();
        await sys.stopAsync();
        await state.stopAsync();
        await conn.stopAsync();
        await webApp.stopAsync();
        config.update();
        await logger.stopAsync();
        // RKS: Uncomment below to see the shutdown process
        //await new Promise<void>((resolve, reject) => { setTimeout(() => { resolve(); }, 20000); });
    }
    catch (err) {
        console.error(`Error stopping processes: ${ err.message }`);
    }
    finally {
        process.exit();
    }
}
if (process.platform === 'win32') {
    let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', async function () {
        try { await stopAsync(); } catch (err) { console.log(`Error shutting down processes ${err.message}`); }
    });
}
else {
    process.stdin.resume();
    process.on('SIGINT', async function () {
        try { return await stopAsync(); } catch (err) { console.log(`Error shutting down processes ${err.message}`); }
    });
}
( async () => { await initAsync() })();