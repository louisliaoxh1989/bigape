/**
 * @desc: index
 * @authors: Yex
 * @date: 2016-09-12 19:39:22
 */

var Bigpipe = require('../../../../src/Bigpipe');
// var Bigpipe = require('bigape');
var layout = require('./layout');
var modA = require('./modA');
var modB = require('./modB');
var modC = require('./modC');

/**
 * modB
 * |- modA
 * 		|--modA_a
 * 		     |--modA_a_a
 * 		|--modA_b
 * |- modB
 */

var HomeAction = Bigpipe.create('home', {
    bootstrap: layout,

    pagelets: [
        // modA,
        modB,
        // modC
    ]
});

module.exports = HomeAction;
