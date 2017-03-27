/**
 * @desc: modD
 * @authors: Yex
 * @date: 2016-09-12 19:49:42
 */


var bigape = require('../../../../src');

module.exports = bigape.createPagelet({
    name: 'params',

    getService: function() {
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                resolve('Async mod-D data');
            }, 10)
        })
    },

    onServiceDone: function(data) {
        return {
            msg: 'parsed mod-params'
        }
    },

    getPipeData: function(modData) {
        return modData;
    }
});
