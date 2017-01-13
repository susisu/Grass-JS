/*
 * Grass-JS / vm.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({
        Nil,
        Cons,
        nil,
        listFromArray,

        Pair,
        pair,

        Inst,
        Abs,
        App,

        RuntimeError,
        VM
    });
}

const co = require("co");

// cons list
class Nil {
    constructor() {
    }

    toString() {
        return "nil";
    }

    isNil() {
        return true;
    }

    car() {
        throw new Error("nil");
    }

    cdr() {
        throw new Error("nil");
    }

    at() {
        throw new Error("nil");
    }

    cons(car) {
        return new Cons(car, this);
    }
}

class Cons {
    constructor(car, cdr) {
        this._car = car;
        this._cdr = cdr;
    }

    toString() {
        return this._car.toString() + " :: " + this._cdr.toString();
    }

    isNil() {
        return false;
    }

    car() {
        return this._car;
    }

    cdr() {
        return this._cdr;
    }

    at(n) {
        let c = this;
        while (n > 0) {
            c = c.cdr();
            n -= 1;
        }
        return c.car();
    }

    cons(car) {
        return new Cons(car, this);
    }
}

const nil = new Nil();

function listFromArray(arr) {
    let list = nil;
    const len  = arr.length;
    for (let i = len - 1; i >= 0; i--) {
        list = list.cons(arr[i]);
    }
    return list;
}

// pair
class Pair {
    constructor(fst, snd) {
        this._fst = fst;
        this._snd = snd;
    }

    toString() {
        return "(" + this._fst.toString() + ", " + this._snd.toString() + ")";
    }

    fst() {
        return this._fst;
    }

    snd() {
        return this._snd;
    }
}

function pair(fst, snd) {
    return new Pair(fst, snd);
}

// values
class Func {
    constructor(code, env) {
        this.code = code;
        this.env  = env;
    }

    toString() {
        return "Func[" + this.code.toString() + ", " + this.env.toString() + "]";
    }
}

class Char {
    constructor(code) {
        this.code = code;
    }

    toString() {
        return "'" + String.fromCharCode(this.code) + "'";
    }

    succ() {
        return new Char((this.code + 1) % 0x100);
    }
}

class Prim {
    constructor(name, func) {
        this.name = name;
        this.func = func;
    }

    toString() {
        return this.name;
    }
}

// instructions
class Inst {
    constructor(pos) {
        this.pos = pos;
    }
}

class App extends Inst {
    constructor(pos, func, arg) {
        super(pos);
        this.func = func;
        this.arg  = arg;
    }

    toString() {
        return "(" + this.func.toString() + " " + this.arg.toString() + ")";
    }
}

class Abs extends Inst {
    constructor(pos, arity, body) {
        super(pos);
        this.arity = arity;
        this.body  = body;
    }

    toString() {
        return "<" + this.arity.toString() + ": " + this.body.toString() + ">";
    }

    decr() {
        return new Abs(this.pos, this.arity - 1, this.body);
    }
}

// virtual machine
class RuntimeError extends Error {
    constructor(trace, message) {
        super(message);
        this.name  = this.constructor.name;
        this.trace = trace;
    }

    addTrace(trace) {
        return new RuntimeError(trace.concat(this.trace), this.message);
    }

    toString() {
        const traceStr = this.trace.map(t => t.toString() + ":\n").join("");
        return this.name + ": " + traceStr + this.message;
    }
}

const POS_VM = "VM";

const TRUE = new Func(
    nil.cons(new Abs(POS_VM, 1, nil.cons(new App(POS_VM, 2, 1)))),
    nil.cons(new Func(nil, nil))
);
const FALSE = new Func(
    nil.cons(new Abs(POS_VM, 1, nil)),
    nil
);
const SUCC = new Prim("Succ", x => {
    if (x instanceof Char) {
        return x.succ();
    }
    else {
        throw new RuntimeError(["Succ"], "not a character");
    }
});
const LOWER_W = new Char(119);

class State {
    constructor(code, env, dump) {
        this.code = code;
        this.env  = env;
        this.dump = dump;
    }

    clone() {
        return new State(this.code, this.env, this.dump);
    }
}

class VM {
    constructor(code, input, output) {
        const IN = new Prim("In", x => {
            const res = input();
            if (res instanceof Promise) {
                return input().then(
                        c => new Char(c),
                        () => x
                    );
            }
            else if (res !== undefined) {
                return new Char(res);
            }
            else {
                return x;
            }
        });
        const OUT = new Prim("Out", x => {
            if (x instanceof Char) {
                output(x.code);
                return x;
            }
            else {
                throw new RuntimeError(["Out"], "not a character");
            }
        });
        this.state = new State(
            code,
            nil.cons(IN).cons(LOWER_W).cons(SUCC).cons(OUT),
            nil.cons(pair(nil, nil)).cons(pair(nil.cons(new App(POS_VM, 0, 0)), nil))
        );
    }

    run(debug) {
        const state = this.state.clone();
        const trace = [];
        return co(function* () {
            while (true) {
                if (state.code.isNil()) {
                    if (!state.env.isNil() && state.env.cdr().isNil() && state.dump.isNil()) {
                        return state.env.car();
                    }
                    else if (!state.env.isNil() && !state.dump.isNil()) {
                        const f = state.env.car();
                        const d = state.dump.car();
                        state.code = d.fst();
                        state.env  = d.snd().cons(f);
                        state.dump = state.dump.cdr();
                        if (debug) {
                            trace.pop();
                        }
                    }
                    else {
                        throw new RuntimeError([POS_VM], "illegal state")
                            .addTrace(trace);
                    }
                }
                else {
                    const inst = state.code.car();
                    if (inst instanceof App) {
                        let ff;
                        let fa;
                        try {
                            ff = state.env.at(inst.func);
                        }
                        catch (_) {
                            throw new RuntimeError(
                                [inst.pos],
                                "function out of bounds: " + (inst.func + 1).toString()
                            ).addTrace(trace);
                        }
                        try {
                            fa = state.env.at(inst.arg);
                        }
                        catch (_) {
                            throw new RuntimeError(
                                [inst.pos],
                                "argument out of bounds: " + (inst.arg + 1).toString()
                            ).addTrace(trace);
                        }
                        if (ff instanceof Func) {
                            if (state.code.cdr().isNil() && !state.dump.isNil()) {
                                // tail call optimization
                                if (debug) {
                                    trace.push(inst.pos);
                                }
                                state.code = ff.code;
                                state.env  = ff.env.cons(fa);
                            }
                            else {
                                if (debug) {
                                    trace.push(inst.pos);
                                }
                                state.dump = state.dump.cons(pair(state.code.cdr(), state.env));
                                state.code = ff.code;
                                state.env  = ff.env.cons(fa);
                            }
                        }
                        else if (ff instanceof Char) {
                            if (debug) {
                                trace.push(inst.pos);
                            }
                            if (fa instanceof Char && ff.code === fa.code) {
                                state.code = state.code.cdr();
                                state.env  = state.env.cons(TRUE);
                            }
                            else {
                                state.code = state.code.cdr();
                                state.env  = state.env.cons(FALSE);
                            }
                            if (debug) {
                                trace.pop();
                            }
                        }
                        else if (ff instanceof Prim) {
                            if (debug) {
                                trace.push(inst.pos);
                            }
                            try {
                                let res = ff.func(fa);
                                if (res instanceof Promise) {
                                    res = yield res;
                                }
                                state.code = state.code.cdr();
                                state.env  = state.env.cons(res);
                            }
                            catch (error) {
                                if (error instanceof RuntimeError) {
                                    throw error.addTrace(trace);
                                }
                                else {
                                    throw error;
                                }
                            }
                            if (debug) {
                                trace.pop();
                            }
                        }
                    }
                    else if (inst instanceof Abs) {
                        if (inst.arity === 1) {
                            state.code = state.code.cdr();
                            state.env  = state.env.cons(new Func(inst.body, state.env));
                        }
                        else {
                            state.code = state.code.cdr();
                            state.env  = state.env.cons(new Func(nil.cons(inst.decr()), state.env));
                        }
                    }
                }
            }
        });
    }
}

end();
