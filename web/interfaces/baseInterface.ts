import extend = require("extend");
import { logger } from "../../logger/Logger";
import { sys } from "../../controller/Equipment";
import { state } from "../../controller/State";
import { webApp } from '../Server';

export class BaseInterfaceBindings {
    constructor(cfg) {
        this.cfg = cfg;
    }
    public context: InterfaceContext;
    public cfg;
    public events: InterfaceEvent[];
    public bindEvent(evt: string, ...data: any) { };
    protected buildTokens(input: string, eventName: string, toks: any, e: InterfaceEvent, data): any {
        toks = toks || [];
        let s = input;
        let regx = /(?<=@bind\=\s*).*?(?=\;)/g;
        let match;
        let vars = extend(true, {}, this.cfg.vars, this.context.vars, typeof e !== 'undefined' && e.vars);
        let sys1 = sys;
        let state1 = state;
        let webApp1 = webApp;
        // Map all the returns to the token list.  We are being very basic
        // here an the object graph is simply based upon the first object occurrence.
        // We simply want to eval against that object reference.

        while (match = regx.exec(s)) {
            let bind = match[0];
            if (typeof toks[bind] !== 'undefined') continue;
            let tok: any = {};
            toks[bind] = tok;
            try {
                // we may error out if data can't be found (eg during init)
                tok.reg = new RegExp("@bind=" + this.escapeRegex(bind) + ";", "g");
                tok.value = eval(bind.replace(/sys./g, 'Equipment_1.sys.').replace(/state./g, 'State_1.state.'));
            }
            catch (err) {
                // leave value undefined so it isn't sent to bindings
                tok[bind] = null;
            }
        }
        return toks;

    }
    protected escapeRegex(reg: string) {
        return reg.replace(/[-[\]{}()*+?.,\\^$]/g, '\\$&');
    }
    protected replaceTokens(input: string, toks: any) {
        let s = input;
        for (let exp in toks) {
            let tok = toks[exp];
            if (typeof tok.reg === 'undefined') continue;
            tok.reg.lastIndex = 0; // Start over if we used this before.
            if (typeof tok.value === 'string') s = s.replace(tok.reg, tok.value);
            else if (typeof tok.value === 'undefined') s = s.replace(tok.reg, 'null');
            else s = s.replace(tok.reg, JSON.stringify(tok.value));
        }
        return s;
    }
}

export class InterfaceEvent {
    public name: string;
    public enabled: boolean = true;
    public options: any = {};
    public body: any = {};
    public vars: any = {};
}
export class InterfaceContext {
    public name: string;
    public mdnsDiscovery: any;
    public upnpDevice: any;
    public options: any = {};
    public vars: any = {};
}
