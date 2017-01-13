/*
 * Grass-JS / parser.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({
        ParseError,
        parse
    });
}

const lq = require("loquat")();

const vm = require("./vm.js");

const whiteSpace     = lq.noneOf("wWvｗＷｖ").skipMany().hidden();
const headWhiteSpace = lq.noneOf("wｗ").skipMany().hidden();

function lexeme(p) {
    return p.skip(whiteSpace);
}

const char_w = lexeme(lq.oneOf("wｗ")).label("w");
const char_W = lexeme(lq.oneOf("WＷ")).label("W");
const char_v = lexeme(lq.oneOf("vｖ")).label("v");

const app = lq.do(function* () {
    const pos  = yield lq.getPosition;
    const func = yield char_W.manyChars1();
    const arg  = yield char_w.manyChars1();
    return new vm.App(pos, func.length - 1, arg.length - 1);
}).label("application");

const abs = lq.do(function* () {
    const pos   = yield lq.getPosition;
    const arity = yield char_w.manyChars1();
    const body  = yield app.many();
    return new vm.Abs(pos, arity.length, vm.listFromArray(body));
}).label("abstraction");

const prog = lq.do(function* () {
    yield headWhiteSpace;
    const head = yield abs;
    const tail = yield char_v.and(abs.or(app.many())).many();
    yield lq.eof;
    return vm.listFromArray([head].concat(flatten(tail)));
});

function flatten(arr) {
    const arr_ = [];
    for (const e of arr) {
        if (Array.isArray(e)) {
            for (const f of e) {
                arr_.push(f);
            }
        }
        else {
            arr_.push(e);
        }
    }
    return arr_;
}

// wrapper of lq.ParseError
class ParseError extends Error {
    constructor(error) {
        super(error.toString());
        this.name  = this.constructor.name;
        this.error = error;
    }

    get pos() {
        return this.error.pos;
    }
}

function parse(name, src) {
    const res = lq.parse(prog, name, src, undefined, { tabWidth: 8 });
    if (res.success) {
        return res.value;
    }
    else {
        throw new ParseError(res.error);
    }
}

end();
