/**
 * @desc: Service 基本数据服务
 * @authors: Yex
 * @date: 2016-08-03 21:08:11
 */

var wrapRequest = require('./wrapRequest');
var config = require('./config');
var monitor = config.plugins('monitor'); //require('@qnpm/q-monitor');
var debug = require('debug'); //require('@qnpm/q-logger');
var logger = debug('bigape');
var _ = require('lodash');

module.exports = {
  /**
   * 请求地址
   */
  url: '',

  /**
   * 请求参数
   */
  params: '',

  /**
   * 监控名称
   */
  monitor: '',

  /**
   * 接口请求失败后的重试次数, 如果不为0, 后端接口返回异常会重新请求接口
   */
  retryTimes: 0,

  /**
   * 接口请求方式，默认是GET
   * @type {String}
   */
  method: 'GET',

  /**
   * 超时时间
   * @type {Number}
   */
  timeout: 30000,

  // 接口代理地址
  proxySet: null,

  // 为所有的service统一设置proxy代理
  $setProxy: function(proxy) {
    if (!proxy) return;
    this.proxySet = proxy;
  },

  // service 原型统一开关
  $setGlobal: function(key, value) {
    if (!key || typeof value === 'undefined') {
      return;
    }

    this[key] = value;
  },

  /**
   * 接口请求前校验，如果失败则停止请求
   * @param  {Object} req request
   * @param  {Object} res response
   * @return {Boolean}    if it checked
   */
  queryValid: function() {
    return true;
  },

  /**
   * 接口请求前校验，如果失败则停止请求
   * @param  {Object} req request
   * @param  {Object} res response
   * @return {Boolean}    if it checked
   */
  beforeQueryValid: function() {
    return true;
  },

  /**
   * 初始化
   */
  init: function() {
    return this;
  },

  /**
   * 获取参数
   * @param req
   * @param res
   * @returns {string}
   */
  getParams: function(req) {
    if (this.params) {
      return this.params;
    }
    if (!_.isEmpty(req.query)) {
      return req.query;
    }
    if (!_.isEmpty(req.body)) {
      return req.body;
    }
    return {};
  },

  /**
   * 获取请求url
   * @param req
   * @param res
   * @returns {string}
   */
  getURL: function() {
    return this.url;
  },

  /**
   * 获取监控名称
   * @param req
   * @param res
   * @returns {string}
   */
  getMonitor: function() {
    return this.qmonitor;
  },

  load: function(req, res) {
    var self = this;

    var beforeLoadValid = this.queryValid(req, res);

    // 有异步校验
    if (this.isPromise(beforeLoadValid)) {
      logger('进行请求前校验');
      return beforeLoadValid
        .then(function() {
          return self._load(req, res);
        })
        .catch(function(error) {
          logger('请求接口前校验失败或数据异常', error);
          throw error;
        });
    }

    if (beforeLoadValid) {
      return this._load(req, res);
    }

    throw beforeLoadValid;
  },

  // 接口代理
  proxy: function(req, res, options) {
    options = _.pick(options || {}, [
      'url',
      'params',
      'method',
      'timeout',
      'validData',
      'qmonitor',
      'retryTimes'
    ]);
    _.extend(this, options);
    return this.json(req, res);
  },

  json: function(req, res) {
    var self = this;
    this.load(req, res)
      .then(function(data) {
        data = self.parse(data);
        res.json(data);
      })
      .catch(function(err) {
        res.json(self._getErrorJson(err));
      });
  },

  /**
   * 从后端加载数据
   * @param req
   * @param res
   * @returns {*}
   */
  _load: function(req, res) {
    var self = this;

    return wrapRequest(this.getURL(req, res), {
      data: this.getParams(req, res),
      qmonitor: this.getMonitor(req, res),
      method: this.method,
      postType: 'json',
      proxy: this.proxySet, //'http://127.0.0.1:8888',
      timeout: this.timeout || 30000,
      headers: this.getHeaders(req, res),
      jsonValid: function(data) {
        return self.validData(data, req, res);
      }
    }).then(
      function(json) {
        return self._preParse(json);
      },
      function(json) {
        return self.reload(req, res, json);
      }
    );
  },

  /**
   * request headers
   * @param  {Object} req request
   * @param  {Object} res response
   * @return {Object}     headers set
   */
  getHeaders: function(req) {
    var cookies = req.cookies, headers = req.headers;

    var sourceObj;

    try {
      sourceObj = JSON.parse(cookies['_plat_source']);
    } catch (e) {
      sourceObj = {
        value: 'jiulvxing'
      };
    }
    return {
      uid: cookies['_uc_uid'],
      channel: sourceObj.value || 'jiulvxing',
      ip: (headers['x-real-ip'] || headers['ip'] || '').replace('::ffff:', ''),
      frontHeadExt: cookies['_frontHeadExt'],
      openDomain: req.hostname,
      plat: 'touch',
      dist: cookies._plat_dist || 'h5' //分发渠道
    };
  },

  // 数据格式预处理
  _preParse: function(json) {
    var bstatus = json.bstatus;
    if (bstatus) {
      return {
        status: bstatus.code,
        message: bstatus.des || 'success',
        des: bstatus.info || '',
        data: json.data
      };
    }
    return {
      status: json.status || json.code || (json.ret ? 0 : -1) || 0,
      message: json.message || json.des || json.msg || 'success',
      data: json.data
    };
  },

  reload: function(req, res, json) {
    var cache = res.locals,
      retryTimes = this.retryTimes,
      retriedTimes = cache.retriedTimes || 0;

    var qmonitorKey = this.getMonitor(req, res);
    // logger('重试次数: ', retryTimes, '已重试次数: ', retriedTimes);

    if (qmonitorKey) {
      monitor.addCount(qmonitorKey + '-api-error');
    }

    if (retryTimes > 0 && retriedTimes < retryTimes) {
      cache.retriedTimes = retriedTimes + 1;
      // console.log('重新请求接口');
      if (qmonitorKey) {
        monitor.addCount(qmonitorKey + '-api-retry');
      }
      return this.load(req, res);
    } else {
      throw this._getErrorJson(json);
    }
  },

  /**
   * 直接返回json数据
   * @param  {Object}   req  request
   * @param  {Object}   res  response
   * @param  {Function} next next
   */
  process: function(req, res) {
    var self = this;
    this.load(req, res)
      .then(function(data) {
        data = self.parse(data);
        res.json(data);
      })
      .catch(function(err) {
        res.json(self._getErrorJson(err));
      });
  },

  /**
   * 数据处理，process 时候才会调用，否则不对数据做处理
   * @param  {Object} data 原始数据
   * @return {Object}      处理之后的数据
   */
  parse: function(data) {
    return data;
  },

  /**
   * 获错误的返回数据
   * @param  {Object} error error Object
   * @return {Object}       error json
   */
  _getErrorJson: function(error) {
    if (error.bstatus) {
      error = {
        code: error.bstatus.code,
        message: error.bstatus.des
      };
    }
    var json = {
      status: error.code || error.status || 500,
      message: error.message || '未获取到数据，请稍后重试',
      data: error.data || null
    };

    error.des ? (json.des = error.des) : null;

    return json;
  },

  create: function(props) {
    var obj = Object.create(this);

    props && _.extend(obj, props);
    return obj;
  },

  /**
   * 自定义 request 响应数据校验
   * @param  {Object} data  返回数据
   * @param  {Object} req   request
   * @param  {Object} res   response
   * @return {Boolean}      flag
   */
  validData: function(data) {
    // success ret
    var ret = (typeof data.status !== 'undefined' && data.status == 0) ||
      (typeof data.code !== 'undefined' &&
        /^\d+$/.test(data.code) &&
        data.code == 0) ||
      (typeof data.ret !== 'undefined' && data.ret === true) ||
      (typeof data.bstatus !== 'undefined' && data.bstatus.code == 0);
    // Object.keys(data).length !== 0;

    return ret;
  },

  /**
   * isPromise - 判断是否为`Promise`对象
   *
   * @param  {type} obj description
   * @return {type}     description
   */
  isPromise: function(obj) {
    return typeof obj.then === 'function';
  }
};
