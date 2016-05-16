/*
 * Grass-JS / vm.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({});
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

    at(n) {
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
    let len  = arr.length;
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
const POS_VM = "VM";

const TRUE = new Func(
        new Abs(POS_VM, 1, nil.cons(new App(POS_VM, 2, 1))),
        nil.cons(new Func(nil, nil))
    );
const FALSE = new Func(
        new Abs(POS_VM, 1, nil),
        nil
    );

const IN = new Prim("In", x => {
        // TODO: read a stream
        return x;
    });
const OUT = new Prim("Out", x => {
        if (x instanceof Char) {
            process.stdout.write(String.fromCharCode(x.code));
            return x;
        }
        else {
            throw new Error("Out: not a character");
        }
    });
const SUCC = new Prim("Succ", x => {
        if (x instanceof Char) {
            return x.succ();
        }
        else {
            throw new Error("Succ: not a character");
        }
    });
const LOWER_W = new Char(119);
const INIT_ENV = nil.cons(IN).cons(LOWER_W).cons(SUCC).cons(OUT);

class VM {
    constructor(code, env, dump) {
        this.code = code;
        this.env  = env;
        this.dump = dump;
    }

    static init(code) {
        return new VM(
            code,
            INIT_ENV,
            nil.cons(pair(nil, nil)).cons(pair(nil.cons(new App(POS_VM, 0, 0)), nil))
        );
    }

    run() {
        let self = this;
        return co(function * () {
            while (true) {
                // console.log("C: " + self.code.toString());
                // console.log("E: " + self.env.toString());
                // console.log("D: " + self.dump.toString());
                // console.log("----------------------------");
                if (self.code.isNil() && self.env.cdr().isNil() && self.dump.isNil()) {
                    return;
                }
                if (self.code.isNil()) {
                    let f = self.env.car();
                    let d = self.dump.car();
                    self.code = d.fst();
                    self.env  = d.snd().cons(f);
                    self.dump = self.dump.cdr();
                }
                else {
                    let inst = self.code.car();
                    if (inst instanceof App) {
                        let ff = self.env.at(inst.func);
                        let fa = self.env.at(inst.arg);
                        if (ff instanceof Func) {
                            self.dump = self.dump.cons(pair(self.code.cdr(), self.env));
                            self.code = ff.code;
                            self.env  = ff.env.cons(fa);
                        }
                        else if (ff instanceof Char) {
                            if (fa instanceof Char && ff.code === fa.code) {
                                self.code = self.code.cdr();
                                self.env  = self.env.cons(TRUE);
                            }
                            else {
                                self.code = self.code.cdr();
                                self.env  = self.env.cons(FALSE);
                            }
                        }
                        else if (ff instanceof Prim) {
                            let res = ff.func(fa);
                            if (res instanceof Promise) {
                                res = yield res;
                            }
                            self.code = self.code.cdr();
                            self.env = self.env.cons(res);
                        }
                    }
                    else if (inst instanceof Abs) {
                        if (inst.arity === 1) {
                            self.code = self.code.cdr();
                            self.env  = self.env.cons(new Func(inst.body, self.env));
                        }
                        else {
                            self.code = self.code.cdr();
                            self.env  = self.env.cons(new Func(nil.cons(inst.decr()), self.env));
                        }
                    }
                    else {
                        throw new Error("unknown VM state");
                    }
                }
            }
        });
    }
}

end();
