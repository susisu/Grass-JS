/*
 * Grass-JS / parser.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({
        parse
    });
}

const lq = require("loquat");

const vm = require("./vm.js");

let whiteSpace = lq.noneOf("wWvｗＷｖ").skipMany().label("");

function lexeme(p) {
    return p.left(whiteSpace);
}

let char_w = lexeme(lq.oneOf("wｗ")).label("w");
let char_W = lexeme(lq.oneOf("WＷ")).label("W");
let char_v = lexeme(lq.oneOf("vｖ")).label("v");

let app = lq.gen(function * () {
    let pos  = yield lq.getPosition;
    let func = yield char_W.manyChar1();
    let arg  = yield char_w.manyChar1();
    return new vm.App(pos, func.length - 1, arg.length - 1);
}).label("application");

let abs = lq.gen(function * () {
    let pos   = yield lq.getPosition;
    let arity = yield char_w.manyChar1();
    let body  = yield app.many();
    return new vm.Abs(pos, arity.length, vm.listFromArray(body));
}).label("abstraction");

let prog = lq.gen(function * () {
    yield whiteSpace
    let head = yield abs;
    let tail = yield char_v.then(abs.or(app.many())).many();
    yield lq.eof;
    return vm.listFromArray([head].concat(flatten(tail)));
});

function flatten(arr) {
    let arr_ = [];
    for (let e of arr) {
        if (Array.isArray(e)) {
            for (let f of e) {
                arr_.push(f);
            }
        }
        else {
            arr_.push(e);
        }
    }
    return arr_;
}

function parse(name, src) {
    let res = lq.parse(prog, name, src, 8);
    if (res.succeeded) {
        return res.value;
    }
    else {
        throw res.error;
    }
}

end();
