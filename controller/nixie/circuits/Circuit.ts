﻿import { EquipmentNotFoundError, InvalidEquipmentDataError, InvalidEquipmentIdError, ParameterOutOfRangeError } from '../../Errors';
import { utils, Timestamp } from '../../Constants';
import { logger } from '../../../logger/Logger';

import { NixieEquipment, NixieChildEquipment, NixieEquipmentCollection, INixieControlPanel } from "../NixieEquipment";
import { Circuit, CircuitCollection, sys } from "../../../controller/Equipment";
import { CircuitState, state, ICircuitState, } from "../../State";
import { setTimeout, clearTimeout } from 'timers';
import { NixieControlPanel } from '../Nixie';
import { webApp, InterfaceServerResponse } from "../../../web/Server";

export class NixieCircuitCollection extends NixieEquipmentCollection<NixieCircuit> {
    public pollingInterval: number = 2000;
    private _pollTimer: NodeJS.Timeout = null;
    public async setCircuitStateAsync(cstate: ICircuitState, val: boolean) {
        try {
            let c: NixieCircuit = this.find(elem => elem.id === cstate.id) as NixieCircuit;
            if (typeof c === 'undefined') return Promise.reject(new Error(`NCP: Circuit ${cstate.id}-${cstate.name} could not be found to set the state to ${val}.`));
            await c.setCircuitStateAsync(cstate, val);
        }
        catch (err) { return logger.reject(`NCP: setCircuitStateAsync ${cstate.id}-${cstate.name}: ${err.message}`); }
    }
    public async setCircuitAsync(circuit: Circuit, data: any) {
        // By the time we get here we know that we are in control and this is a REMChem.
        try {
            let c: NixieCircuit = this.find(elem => elem.id === circuit.id) as NixieCircuit;
            if (typeof c === 'undefined') {
                circuit.master = 1;
                c = new NixieCircuit(this.controlPanel, circuit);
                this.push(c);
                await c.setCircuitAsync(data);
                logger.debug(`NixieController: A circuit was not found for id #${circuit.id} creating circuit`);
            }
            else {
                await c.setCircuitAsync(data);
            }
        }
        catch (err) { logger.error(`setCircuitAsync: ${err.message}`); return Promise.reject(err); }
    }
    public async initAsync(circuits: CircuitCollection) {
        try {
            this.length = 0;
            for (let i = 0; i < circuits.length; i++) {
                let circuit = circuits.getItemByIndex(i);
                if (circuit.master === 1) {
                    logger.info(`Initializing Nixie circuit ${circuit.name}`);
                    let ncircuit = new NixieCircuit(this.controlPanel, circuit);
                    this.push(ncircuit);
                }
            }
        }
        catch (err) { return Promise.reject(logger.error(`NixieController: Circuit initAsync: ${err.message}`)); }
    }
    public async closeAsync() {
        try {
            for (let i = this.length - 1; i >= 0; i--) {
                try {
                    await this[i].closeAsync();
                    this.splice(i, 1);
                } catch (err) { logger.error(`Error stopping Nixie Circuit ${err}`); }
            }

        } catch (err) { } // Don't bail if we have an errror.
    }

    public async initCircuitAsync(circuit: Circuit): Promise<NixieCircuit> {
        try {
            let c: NixieCircuit = this.find(elem => elem.id === circuit.id) as NixieCircuit;
            if (typeof c === 'undefined') {
                c = new NixieCircuit(this.controlPanel, circuit);
                this.push(c);
            }
            return c;
        } catch (err) { logger.error(`initCircuitAsync: ${err.message}`); return Promise.reject(err); }
    }
    public async pollCircuitsAsync() {
        try {
            if (typeof this._pollTimer !== 'undefined' || this._pollTimer) clearTimeout(this._pollTimer);
            this._pollTimer = null;
            let success = false;

        } catch (err) { logger.error(`Error polling circuits: ${err.message}`); return Promise.reject(err); }
        finally { this._pollTimer = setTimeout(async () => await this.pollCircuitsAsync(), this.pollingInterval || 10000); }
    }
}
export class NixieCircuit extends NixieEquipment {
    public circuit: Circuit;
    constructor(ncp: INixieControlPanel, circuit: Circuit) {
        super(ncp);
        this.circuit = circuit;
    }
    public get id(): number { return typeof this.circuit !== 'undefined' ? this.circuit.id : -1; }
    public async setCircuitAsync(data: any) {
        try {
            let circuit = this.circuit;
        }
        catch (err) { logger.error(`Nixie setCircuitAsync: ${err.message}`); return Promise.reject(err); }
    }
    public async setCircuitStateAsync(cstate: ICircuitState, val: boolean): Promise<InterfaceServerResponse> {
        try {
            if(val !== cstate.isOn) logger.info(`NCP: Setting Circuit ${cstate.name} to ${val}`);
            if (utils.isNullOrEmpty(this.circuit.connectionId) || utils.isNullOrEmpty(this.circuit.deviceBinding)) {
                cstate.isOn = val;
                return new InterfaceServerResponse(200, 'Success');
            }
            let res = await NixieEquipment.putDeviceService(this.circuit.connectionId, `/state/device/${this.circuit.deviceBinding}`, { isOn: val, latch: val ? 7000 : undefined });
            if (res.status.code === 200) cstate.isOn = val;
            return res;
        } catch (err) { logger.error(`Nixie: Error setting circuit state ${cstate.id}-${cstate.name} to ${val}`); }
    }
    private async checkHardwareStatusAsync(connectionId: string, deviceBinding: string) {
        try {
            let dev = await NixieEquipment.getDeviceService(connectionId, `/status/device/${deviceBinding}`);
            return dev;
        } catch (err) { logger.error(`Nixie Circuit checkHardwareStatusAsync: ${err.message}`); return { hasFault: true } }
    }
    public async validateSetupAsync(circuit: Circuit, cstate: CircuitState) {
        try {
            if (typeof circuit.connectionId !== 'undefined' && circuit.connectionId !== ''
                && typeof circuit.deviceBinding !== 'undefined' && circuit.deviceBinding !== '') {
                try {
                    let stat = await this.checkHardwareStatusAsync(circuit.connectionId, circuit.deviceBinding);
                    // If we have a status check the return.
                    cstate.commStatus = stat.hasFault ? 1 : 0;
                } catch (err) { cstate.commStatus = 1; }
            }
            else
                cstate.commStatus = 0;
            // The validation will be different if the circuit is on or not.  So lets get that information.
        } catch (err) { logger.error(`Nixie Error checking Circuit Hardware ${this.circuit.name}: ${err.message}`); cstate.commStatus = 1; return Promise.reject(err); }
    }
    public async closeAsync() {
        try {
            let cstate = state.circuits.getItemById(this.circuit.id);
            await this.setCircuitStateAsync(cstate, false);
        }
        catch (err) { logger.error(`Nixie Circuit closeAsync: ${err.message}`); return Promise.reject(err); }
    }
    public logData(filename: string, data: any) { this.controlPanel.logData(filename, data); }
}
