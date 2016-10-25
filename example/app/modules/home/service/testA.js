var Service = require('../../../../src/Service');
var _ = require('lodash');

var service = Service.create({

    qmonitor: 'login_validate_api',

    getURL: function() {
        return 'http://user.jiulvxing.com/ucenter/verify';
        // return URL('ONE_WAY_LIST');
    },

    method: 'GET',

    validData: function (data) {
        return true;
    },

    getParams: function(req, res) {
        return {
            token: req.cookies._uc_token
        }
    }
});

module.exports = service;
