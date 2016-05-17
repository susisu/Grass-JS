/*
 * Grass-JS / grass.js
 * copyright (c) 2016 Susisu
 */

"use strict";

function end() {
    module.exports = Object.freeze({
        vm,
        parser
    });
}

const vm     = require("./vm.js");
const parser = require("./parser.js");

end();
