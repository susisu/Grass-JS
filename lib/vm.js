/*
 * Grass-JS / vm.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({});
}

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

end();
