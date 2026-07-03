"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Symbol$toPrimitive = require("@babel/runtime-corejs3/core-js-stable/symbol/to-primitive");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty2 = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
require("core-js/modules/es.string.replace");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.Connection = void 0;
var _entries = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/entries"));
var _forEach = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/for-each"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _stringify = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/json/stringify"));
var _parseInt2 = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/parse-int"));
var _promise = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/promise"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _slice = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/slice"));
var _events = require("events");
var _jsforce = _interopRequireDefault(require("./jsforce"));
var _transport = _interopRequireWildcard(require("./transport"));
var _logger = require("./util/logger");
var _oauth = _interopRequireDefault(require("./oauth2"));
var _cache = _interopRequireDefault(require("./cache"));
var _httpApi = _interopRequireDefault(require("./http-api"));
var _sessionRefreshDelegate = _interopRequireDefault(require("./session-refresh-delegate"));
var _query = _interopRequireDefault(require("./query"));
var _sobject = _interopRequireDefault(require("./sobject"));
var _quickAction = _interopRequireDefault(require("./quick-action"));
var _process = _interopRequireDefault(require("./process"));
var _formatter = require("./util/formatter");
var _formData = _interopRequireDefault(require("form-data"));
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[_Symbol$toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context7; _forEachInstanceProperty2(_context7 = ownKeys(Object(source), true)).call(_context7, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context8; _forEachInstanceProperty2(_context8 = ownKeys(Object(source))).call(_context8, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       */
/**
 * type definitions
 */

/**
 *
 */
const defaultConnectionConfig = {
  loginUrl: 'https://login.salesforce.com',
  instanceUrl: '',
  version: '50.0',
  logLevel: 'NONE',
  maxRequest: 10
};

/**
 *
 */
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 *
 */
function parseSignedRequest(sr) {
  if (typeof sr === 'string') {
    if (sr[0] === '{') {
      // might be JSON
      return JSON.parse(sr);
    } // might be original base64-encoded signed request
    const msg = sr.split('.').pop(); // retrieve latter part
    if (!msg) {
      throw new Error('Invalid signed request');
    }
    const json = Buffer.from(msg, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return sr;
}

/** @private **/
function parseIdUrl(url) {
  var _context;
  const [organizationId, id] = (0, _slice.default)(_context = url.split('/')).call(_context, -2);
  return {
    id,
    organizationId,
    url
  };
}

/**
 * Session Refresh delegate function for OAuth2 authz code flow
 * @private
 */
async function oauthRefreshFn(conn, callback) {
  try {
    if (!conn.refreshToken) {
      throw new Error('No refresh token found in the connection');
    }
    const res = await conn.oauth2.refreshToken(conn.refreshToken);
    const userInfo = parseIdUrl(res.id);
    conn._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      userInfo
    });
    callback(undefined, res.access_token, res);
  } catch (err) {
    if (err instanceof Error) {
      callback(err);
    } else {
      throw err;
    }
  }
}

/**
 * Session Refresh delegate function for username/password login
 * @private
 */
function createUsernamePasswordRefreshFn(username, password) {
  return async (conn, callback) => {
    try {
      await conn.login(username, password);
      if (!conn.accessToken) {
        throw new Error('Access token not found after login');
      }
      callback(null, conn.accessToken);
    } catch (err) {
      if (err instanceof Error) {
        callback(err);
      } else {
        throw err;
      }
    }
  };
}

/**
 * @private
 */
function toSaveResult(err) {
  return {
    success: false,
    errors: [err]
  };
}

/**
 *
 */
function raiseNoModuleError(name) {
  throw new Error(`API module '${name}' is not loaded, load 'jsforce/api/${name}' explicitly`);
}

/*
 * Constant of maximum records num in DML operation (update/delete)
 */
const MAX_DML_COUNT = 200;

/**
 *
 */
class Connection extends _events.EventEmitter {
  // describe: (name: string) => Promise<DescribeSObjectResult>;

  // describeGlobal: () => Promise<DescribeGlobalResult>;

  // API libs are not instantiated here so that core module to remain without dependencies to them
  // It is responsible for developers to import api libs explicitly if they are using 'jsforce/core' instead of 'jsforce'.
  get analytics() {
    return raiseNoModuleError('analytics');
  }
  get apex() {
    return raiseNoModuleError('apex');
  }
  get bulk() {
    return raiseNoModuleError('bulk');
  }
  get bulk2() {
    return raiseNoModuleError('bulk2');
  }
  get chatter() {
    return raiseNoModuleError('chatter');
  }
  get metadata() {
    return raiseNoModuleError('metadata');
  }
  get soap() {
    return raiseNoModuleError('soap');
  }
  get streaming() {
    return raiseNoModuleError('streaming');
  }
  get tooling() {
    return raiseNoModuleError('tooling');
  }

  /**
   *
   */
  constructor(config = {}) {
    super();
    (0, _defineProperty2.default)(this, "version", void 0);
    (0, _defineProperty2.default)(this, "loginUrl", void 0);
    (0, _defineProperty2.default)(this, "instanceUrl", void 0);
    (0, _defineProperty2.default)(this, "accessToken", void 0);
    (0, _defineProperty2.default)(this, "refreshToken", void 0);
    (0, _defineProperty2.default)(this, "userInfo", void 0);
    (0, _defineProperty2.default)(this, "limitInfo", {});
    (0, _defineProperty2.default)(this, "oauth2", void 0);
    (0, _defineProperty2.default)(this, "sobjects", {});
    (0, _defineProperty2.default)(this, "cache", void 0);
    (0, _defineProperty2.default)(this, "_callOptions", void 0);
    (0, _defineProperty2.default)(this, "_maxRequest", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "_logLevel", void 0);
    (0, _defineProperty2.default)(this, "_transport", void 0);
    (0, _defineProperty2.default)(this, "_sessionType", void 0);
    (0, _defineProperty2.default)(this, "_refreshDelegate", void 0);
    (0, _defineProperty2.default)(this, "describe$", void 0);
    (0, _defineProperty2.default)(this, "describe$$", void 0);
    (0, _defineProperty2.default)(this, "describeSObject", void 0);
    (0, _defineProperty2.default)(this, "describeSObject$", void 0);
    (0, _defineProperty2.default)(this, "describeSObject$$", void 0);
    (0, _defineProperty2.default)(this, "describeGlobal$", void 0);
    (0, _defineProperty2.default)(this, "describeGlobal$$", void 0);
    (0, _defineProperty2.default)(this, "insert", this.create);
    (0, _defineProperty2.default)(this, "delete", this.destroy);
    (0, _defineProperty2.default)(this, "del", this.destroy);
    (0, _defineProperty2.default)(this, "process", new _process.default(this));
    const {
      loginUrl,
      instanceUrl,
      version,
      oauth2,
      maxRequest,
      logLevel,
      proxyUrl,
      httpProxy
    } = config;
    this.loginUrl = loginUrl || defaultConnectionConfig.loginUrl;
    this.instanceUrl = instanceUrl || defaultConnectionConfig.instanceUrl;
    this.version = version || defaultConnectionConfig.version;
    this.oauth2 = oauth2 instanceof _oauth.default ? oauth2 : new _oauth.default(_objectSpread({
      loginUrl: this.loginUrl,
      proxyUrl,
      httpProxy
    }, oauth2));
    let refreshFn = config.refreshFn;
    if (!refreshFn && this.oauth2.clientId) {
      refreshFn = oauthRefreshFn;
    }
    if (refreshFn) {
      this._refreshDelegate = new _sessionRefreshDelegate.default(this, refreshFn);
    }
    this._maxRequest = maxRequest || defaultConnectionConfig.maxRequest;
    this._logger = logLevel ? Connection._logger.createInstance(logLevel) : Connection._logger;
    this._logLevel = logLevel;
    this._transport = proxyUrl ? new _transport.XdProxyTransport(proxyUrl) : httpProxy ? new _transport.HttpProxyTransport(httpProxy) : new _transport.default();
    this._callOptions = config.callOptions;
    this.cache = new _cache.default();
    const describeCacheKey = type => type ? `describe.${type}` : 'describe';
    const describe = Connection.prototype.describe;
    this.describe = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'NOCACHE'
    });
    this.describe$ = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'HIT'
    });
    this.describe$$ = this.cache.createCachedFunction(describe, this, {
      key: describeCacheKey,
      strategy: 'IMMEDIATE'
    });
    this.describeSObject = this.describe;
    this.describeSObject$ = this.describe$;
    this.describeSObject$$ = this.describe$$;
    const describeGlobal = Connection.prototype.describeGlobal;
    this.describeGlobal = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'NOCACHE'
    });
    this.describeGlobal$ = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'HIT'
    });
    this.describeGlobal$$ = this.cache.createCachedFunction(describeGlobal, this, {
      key: 'describeGlobal',
      strategy: 'IMMEDIATE'
    });
    const {
      accessToken,
      refreshToken,
      sessionId,
      serverUrl,
      signedRequest
    } = config;
    this._establish({
      accessToken,
      refreshToken,
      instanceUrl,
      sessionId,
      serverUrl,
      signedRequest
    });
    _jsforce.default.emit('connection:new', this);
  }

  /* @private */
  _establish(options) {
    var _context2;
    const {
      accessToken,
      refreshToken,
      instanceUrl,
      sessionId,
      serverUrl,
      signedRequest,
      userInfo
    } = options;
    this.instanceUrl = serverUrl ? (0, _slice.default)(_context2 = serverUrl.split('/')).call(_context2, 0, 3).join('/') : instanceUrl || this.instanceUrl;
    this.accessToken = sessionId || accessToken || this.accessToken;
    this.refreshToken = refreshToken || this.refreshToken;
    if (this.refreshToken && !this._refreshDelegate) {
      throw new Error('Refresh token is specified without oauth2 client information or refresh function');
    }
    const signedRequestObject = signedRequest && parseSignedRequest(signedRequest);
    if (signedRequestObject) {
      this.accessToken = signedRequestObject.client.oauthToken;
      if (_transport.CanvasTransport.supported) {
        this._transport = new _transport.CanvasTransport(signedRequestObject);
      }
    }
    this.userInfo = userInfo || this.userInfo;
    this._sessionType = sessionId ? 'soap' : 'oauth2';
    this._resetInstance();
  }

  /* @priveate */
  _clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.instanceUrl = defaultConnectionConfig.instanceUrl;
    this.userInfo = null;
    this._sessionType = null;
  }

  /* @priveate */
  _resetInstance() {
    this.limitInfo = {};
    this.sobjects = {};
    // TODO impl cache
    this.cache.clear();
    this.cache.get('describeGlobal').removeAllListeners('value');
    this.cache.get('describeGlobal').on('value', ({
      result
    }) => {
      if (result) {
        for (const so of result.sobjects) {
          this.sobject(so.name);
        }
      }
    });
    /*
    if (this.tooling) {
      this.tooling._resetInstance();
    }
    */
  }

  /**
   * Authorize the connection using OAuth2 flow.
   * Typically, just pass the code returned from authorization server in the first argument to complete authorization.
   * If you want to authorize with grant types other than `authorization_code`, you can also pass params object with the grant type.
   *
   * @returns {Promise<UserInfo>} An object that contains the user ID, org ID and identity URL.
   *
   */
  async authorize(codeOrParams, params = {}) {
    const res = await this.oauth2.requestToken(codeOrParams, params);
    const userInfo = parseIdUrl(res.id);
    this._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      userInfo
    });
    this._logger.debug(`<login> completed. user id = ${userInfo.id}, org id = ${userInfo.organizationId}`);
    return userInfo;
  }

  /**
   *
   */
  async login(username, password) {
    this._refreshDelegate = new _sessionRefreshDelegate.default(this, createUsernamePasswordRefreshFn(username, password));
    if (this.oauth2 && this.oauth2.clientId && this.oauth2.clientSecret) {
      return this.loginByOAuth2(username, password);
    }
    return this.loginBySoap(username, password);
  }

  /**
   * Login by OAuth2 username & password flow
   */
  async loginByOAuth2(username, password) {
    const res = await this.oauth2.authenticate(username, password);
    const userInfo = parseIdUrl(res.id);
    this._establish({
      instanceUrl: res.instance_url,
      accessToken: res.access_token,
      userInfo
    });
    this._logger.info(`<login> completed. user id = ${userInfo.id}, org id = ${userInfo.organizationId}`);
    return userInfo;
  }

  /**
   *
   */
  async loginBySoap(username, password) {
    var _context3;
    if (!username || !password) {
      return _promise.default.reject(new Error('no username password given'));
    }
    const body = ['<se:Envelope xmlns:se="http://schemas.xmlsoap.org/soap/envelope/">', '<se:Header/>', '<se:Body>', '<login xmlns="urn:partner.soap.sforce.com">', `<username>${esc(username)}</username>`, `<password>${esc(password)}</password>`, '</login>', '</se:Body>', '</se:Envelope>'].join('');
    const soapLoginEndpoint = [this.loginUrl, 'services/Soap/u', this.version].join('/');
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: soapLoginEndpoint,
      body,
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: '""'
      }
    });
    let m;
    if (response.statusCode >= 400) {
      m = response.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const faultstring = m && m[1];
      throw new Error(faultstring || response.body);
    }
    this._logger.debug(`SOAP response = ${response.body}`);
    m = response.body.match(/<serverUrl>([^<]+)<\/serverUrl>/);
    const serverUrl = m && m[1];
    m = response.body.match(/<sessionId>([^<]+)<\/sessionId>/);
    const sessionId = m && m[1];
    m = response.body.match(/<userId>([^<]+)<\/userId>/);
    const userId = m && m[1];
    m = response.body.match(/<organizationId>([^<]+)<\/organizationId>/);
    const organizationId = m && m[1];
    if (!serverUrl || !sessionId || !userId || !organizationId) {
      throw new Error('could not extract session information from login response');
    }
    const idUrl = [this.loginUrl, 'id', organizationId, userId].join('/');
    const userInfo = {
      id: userId,
      organizationId,
      url: idUrl
    };
    this._establish({
      serverUrl: (0, _slice.default)(_context3 = serverUrl.split('/')).call(_context3, 0, 3).join('/'),
      sessionId,
      userInfo
    });
    this._logger.info(`<login> completed. user id = ${userId}, org id = ${organizationId}`);
    return userInfo;
  }

  /**
   * Logout the current session
   */
  async logout(revoke) {
    this._refreshDelegate = undefined;
    if (this._sessionType === 'oauth2') {
      return this.logoutByOAuth2(revoke);
    }
    return this.logoutBySoap(revoke);
  }

  /**
   * Logout the current session by revoking access token via OAuth2 session revoke
   */
  async logoutByOAuth2(revoke) {
    const token = revoke ? this.refreshToken : this.accessToken;
    if (token) {
      await this.oauth2.revokeToken(token);
    }
    // Destroy the session bound to this connection
    this._clearSession();
    this._resetInstance();
  }

  /**
   * Logout the session by using SOAP web service API
   */
  async logoutBySoap(revoke) {
    const body = ['<se:Envelope xmlns:se="http://schemas.xmlsoap.org/soap/envelope/">', '<se:Header>', '<SessionHeader xmlns="urn:partner.soap.sforce.com">', `<sessionId>${esc(revoke ? this.refreshToken : this.accessToken)}</sessionId>`, '</SessionHeader>', '</se:Header>', '<se:Body>', '<logout xmlns="urn:partner.soap.sforce.com"/>', '</se:Body>', '</se:Envelope>'].join('');
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: [this.instanceUrl, 'services/Soap/u', this.version].join('/'),
      body,
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: '""'
      }
    });
    this._logger.debug(`SOAP statusCode = ${response.statusCode}, response = ${response.body}`);
    if (response.statusCode >= 400) {
      const m = response.body.match(/<faultstring>([^<]+)<\/faultstring>/);
      const faultstring = m && m[1];
      throw new Error(faultstring || response.body);
    }
    // Destroy the session bound to this connection
    this._clearSession();
    this._resetInstance();
  }

  /**
   * Send REST API request with given HTTP request info, with connected session information.
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  request(request, options = {}) {
    // if request is simple string, regard it as url in GET method
    let request_ = typeof request === 'string' ? {
      method: 'GET',
      url: request
    } : request;
    // if url is given in relative path, prepend base url or instance url before.
    request_ = _objectSpread(_objectSpread({}, request_), {}, {
      url: this._normalizeUrl(request_.url)
    });
    const httpApi = new _httpApi.default(this, options);
    // log api usage and its quota
    httpApi.on('response', response => {
      if (response.headers && response.headers['sforce-limit-info']) {
        const apiUsage = response.headers['sforce-limit-info'].match(/api-usage=(\d+)\/(\d+)/);
        if (apiUsage) {
          this.limitInfo = {
            apiUsage: {
              used: (0, _parseInt2.default)(apiUsage[1], 10),
              limit: (0, _parseInt2.default)(apiUsage[2], 10)
            }
          };
        }
      }
    });
    return httpApi.request(request_);
  }

  /**
   * Send HTTP GET request
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  requestGet(url, options) {
    const request = {
      method: 'GET',
      url
    };
    return this.request(request, options);
  }

  /**
   * Send HTTP POST request with JSON body, with connected session information
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  requestPost(url, body, options) {
    const request = {
      method: 'POST',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }

  /**
   * Send HTTP PUT request with JSON body, with connected session information
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  requestPut(url, body, options) {
    const request = {
      method: 'PUT',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }

  /**
   * Send HTTP PATCH request with JSON body
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  requestPatch(url, body, options) {
    const request = {
      method: 'PATCH',
      url,
      body: (0, _stringify.default)(body),
      headers: {
        'content-type': 'application/json'
      }
    };
    return this.request(request, options);
  }

  /**
   * Send HTTP DELETE request
   *
   * Endpoint URL can be absolute URL ('https://na1.salesforce.com/services/data/v32.0/sobjects/Account/describe')
   * , relative path from root ('/services/data/v32.0/sobjects/Account/describe')
   * , or relative path from version root ('/sobjects/Account/describe').
   */
  requestDelete(url, options) {
    const request = {
      method: 'DELETE',
      url
    };
    return this.request(request, options);
  }

  /** @private **/
  _baseUrl() {
    return [this.instanceUrl, 'services/data', `v${this.version}`].join('/');
  }

  /**
   * Convert path to absolute url
   * @private
   */
  _normalizeUrl(url) {
    if (url[0] === '/') {
      if ((0, _indexOf.default)(url).call(url, this.instanceUrl + '/services/') === 0) {
        return url;
      }
      if ((0, _indexOf.default)(url).call(url, '/services/') === 0) {
        return this.instanceUrl + url;
      }
      return this._baseUrl() + url;
    }
    return url;
  }

  /**
   *
   */
  query(soql, options) {
    return new _query.default(this, soql, options);
  }

  /**
   * Execute search by SOSL
   *
   * @param {String} sosl - SOSL string
   * @param {Callback.<Array.<RecordResult>>} [callback] - Callback function
   * @returns {Promise.<Array.<RecordResult>>}
   */
  search(sosl) {
    var url = this._baseUrl() + '/search?q=' + encodeURIComponent(sosl);
    return this.request(url);
  }

  /**
   *
   */
  queryMore(locator, options) {
    return new _query.default(this, {
      locator
    }, options);
  }

  /* */
  _ensureVersion(majorVersion) {
    const versions = this.version.split('.');
    return (0, _parseInt2.default)(versions[0], 10) >= majorVersion;
  }

  /* */
  _supports(feature) {
    switch (feature) {
      case 'sobject-collection':
        // sobject collection is available only in API ver 42.0+
        return this._ensureVersion(42);
      default:
        return false;
    }
  }

  /**
   * Retrieve specified records
   */

  async retrieve(type, ids, options = {}) {
    return (0, _isArray.default)(ids) ?
    // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._retrieveMany(type, ids, options) : this._retrieveParallel(type, ids, options) : this._retrieveSingle(type, ids, options);
  }

  /** @private */
  async _retrieveSingle(type, id, options) {
    if (!id) {
      throw new Error('Invalid record ID. Specify valid record ID value');
    }
    let url = [this._baseUrl(), 'sobjects', type, id].join('/');
    const {
      fields,
      headers
    } = options;
    if (fields) {
      url += `?fields=${fields.join(',')}`;
    }
    return this.request({
      method: 'GET',
      url,
      headers
    });
  }

  /** @private */
  async _retrieveParallel(type, ids, options) {
    if (ids.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }
    return _promise.default.all((0, _map.default)(ids).call(ids, id => this._retrieveSingle(type, id, options).catch(err => {
      if (options.allOrNone || err.errorCode !== 'NOT_FOUND') {
        throw err;
      }
      return null;
    })));
  }

  /** @private */
  async _retrieveMany(type, ids, options) {
    var _context4;
    if (ids.length === 0) {
      return [];
    }
    const url = [this._baseUrl(), 'composite', 'sobjects', type].join('/');
    const fields = options.fields || (0, _map.default)(_context4 = (await this.describe$(type)).fields).call(_context4, field => field.name);
    return this.request({
      method: 'POST',
      url,
      body: (0, _stringify.default)({
        ids,
        fields
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }

  /**
   * Create records
   */

  /**
   * @param type
   * @param records
   * @param options
   */
  async create(type, records, options = {}) {
    const ret = (0, _isArray.default)(records) ?
    // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? await this._createMany(type, records, options) : await this._createParallel(type, records, options) : await this._createSingle(type, records, options);
    return ret;
  }

  /** @private */
  async _createSingle(type, record, options) {
    const {
        Id,
        type: rtype,
        attributes
      } = record,
      rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
    const sobjectType = type || attributes && attributes.type || rtype;
    if (!sobjectType) {
      throw new Error('No SObject Type defined in record');
    }
    const url = [this._baseUrl(), 'sobjects', sobjectType].join('/');
    let contentType, body;
    if (options && options.multipartFileFields) {
      var _context5;
      // Send the record as a multipart/form-data request. Useful for fields containing large binary blobs.
      const form = new _formData.default();
      // Extract the fields requested to be sent separately from the JSON
      (0, _forEach.default)(_context5 = (0, _entries.default)(options.multipartFileFields)).call(_context5, ([fieldName, fileDetails]) => {
        form.append(fieldName, Buffer.from(rec[fieldName], 'base64'), fileDetails);
        delete rec[fieldName];
      });
      // Serialize the remaining fields as JSON
      form.append(type, (0, _stringify.default)(rec), {
        contentType: 'application/json'
      });
      contentType = form.getHeaders()['content-type']; // This is necessary to ensure the 'boundary' is present
      body = form;
    } else {
      // Default behavior: send the request as JSON
      contentType = 'application/json';
      body = (0, _stringify.default)(rec);
    }
    return this.request({
      method: 'POST',
      url,
      body: body,
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': contentType
      })
    });
  }

  /** @private */
  async _createParallel(type, records, options) {
    if (records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }
    return _promise.default.all((0, _map.default)(records).call(records, record => this._createSingle(type, record, options).catch(err => {
      // be aware that allOrNone in parallel mode will not revert the other successful requests
      // it only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }
      return toSaveResult(err);
    })));
  }

  /** @private */
  async _createMany(type, records, options) {
    if (records.length === 0) {
      return _promise.default.resolve([]);
    }
    if (records.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._createMany(type, (0, _slice.default)(records).call(records, 0, MAX_DML_COUNT), options)), ...(await this._createMany(type, (0, _slice.default)(records).call(records, MAX_DML_COUNT), options))];
    }
    const _records = (0, _map.default)(records).call(records, record => {
      const {
          Id,
          type: rtype,
          attributes
        } = record,
        rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
      const sobjectType = type || attributes && attributes.type || rtype;
      if (!sobjectType) {
        throw new Error('No SObject Type defined in record');
      }
      return _objectSpread({
        attributes: {
          type: sobjectType
        }
      }, rec);
    });
    const url = [this._baseUrl(), 'composite', 'sobjects'].join('/');
    return this.request({
      method: 'POST',
      url,
      body: (0, _stringify.default)({
        allOrNone: options.allOrNone || false,
        records: _records
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }

  /**
   * Synonym of Connection#create()
   */

  /**
   * Update records
   */

  /**
   * @param type
   * @param records
   * @param options
   */
  update(type, records, options = {}) {
    return (0, _isArray.default)(records) ?
    // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._updateMany(type, records, options) : this._updateParallel(type, records, options) : this._updateSingle(type, records, options);
  }

  /** @private */
  async _updateSingle(type, record, options) {
    const {
        Id: id,
        type: rtype,
        attributes
      } = record,
      rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
    if (!id) {
      throw new Error('Record id is not found in record.');
    }
    const sobjectType = type || attributes && attributes.type || rtype;
    if (!sobjectType) {
      throw new Error('No SObject Type defined in record');
    }
    const url = [this._baseUrl(), 'sobjects', sobjectType, id].join('/');
    return this.request({
      method: 'PATCH',
      url,
      body: (0, _stringify.default)(rec),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    }, {
      noContentResponse: {
        id,
        success: true,
        errors: []
      }
    });
  }

  /** @private */
  async _updateParallel(type, records, options) {
    if (records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }
    return _promise.default.all((0, _map.default)(records).call(records, record => this._updateSingle(type, record, options).catch(err => {
      // be aware that allOrNone in parallel mode will not revert the other successful requests
      // it only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }
      return toSaveResult(err);
    })));
  }

  /** @private */
  async _updateMany(type, records, options) {
    if (records.length === 0) {
      return [];
    }
    if (records.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._updateMany(type, (0, _slice.default)(records).call(records, 0, MAX_DML_COUNT), options)), ...(await this._updateMany(type, (0, _slice.default)(records).call(records, MAX_DML_COUNT), options))];
    }
    const _records = (0, _map.default)(records).call(records, record => {
      const {
          Id: id,
          type: rtype,
          attributes
        } = record,
        rec = (0, _objectWithoutProperties2.default)(record, ["Id", "type", "attributes"]);
      if (!id) {
        throw new Error('Record id is not found in record.');
      }
      const sobjectType = type || attributes && attributes.type || rtype;
      if (!sobjectType) {
        throw new Error('No SObject Type defined in record');
      }
      return _objectSpread({
        id,
        attributes: {
          type: sobjectType
        }
      }, rec);
    });
    const url = [this._baseUrl(), 'composite', 'sobjects'].join('/');
    return this.request({
      method: 'PATCH',
      url,
      body: (0, _stringify.default)({
        allOrNone: options.allOrNone || false,
        records: _records
      }),
      headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
        'content-type': 'application/json'
      })
    });
  }

  /**
   * Upsert records
   */

  /**
   *
   * @param type
   * @param records
   * @param extIdField
   * @param options
   */
  async upsert(type, records, extIdField, options = {}) {
    const isArray = (0, _isArray.default)(records);
    const _records = (0, _isArray.default)(records) ? records : [records];
    if (_records.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }
    const results = await _promise.default.all((0, _map.default)(_records).call(_records, record => {
      var _context6;
      const {
          [extIdField]: extId,
          type: rtype,
          attributes
        } = record,
        rec = (0, _objectWithoutProperties2.default)(record, (0, _map.default)(_context6 = [extIdField, "type", "attributes"]).call(_context6, _toPropertyKey));
      const url = [this._baseUrl(), 'sobjects', type, extIdField, extId].join('/');
      return this.request({
        method: 'PATCH',
        url,
        body: (0, _stringify.default)(rec),
        headers: _objectSpread(_objectSpread({}, options.headers || {}), {}, {
          'content-type': 'application/json'
        })
      }, {
        noContentResponse: {
          success: true,
          errors: []
        }
      }).catch(err => {
        // Be aware that `allOrNone` option in upsert method
        // will not revert the other successful requests.
        // It only raises error when met at least one failed request.
        if (!isArray || options.allOrNone || !err.errorCode) {
          throw err;
        }
        return toSaveResult(err);
      });
    }));
    return isArray ? results : results[0];
  }

  /**
   * Delete records
   */

  /**
   * @param type
   * @param ids
   * @param options
   */
  async destroy(type, ids, options = {}) {
    return (0, _isArray.default)(ids) ?
    // check the version whether SObject collection API is supported (42.0)
    this._ensureVersion(42) ? this._destroyMany(type, ids, options) : this._destroyParallel(type, ids, options) : this._destroySingle(type, ids, options);
  }

  /** @private */
  async _destroySingle(type, id, options) {
    const url = [this._baseUrl(), 'sobjects', type, id].join('/');
    return this.request({
      method: 'DELETE',
      url,
      headers: options.headers || {}
    }, {
      noContentResponse: {
        id,
        success: true,
        errors: []
      }
    });
  }

  /** @private */
  async _destroyParallel(type, ids, options) {
    if (ids.length > this._maxRequest) {
      throw new Error('Exceeded max limit of concurrent call');
    }
    return _promise.default.all((0, _map.default)(ids).call(ids, id => this._destroySingle(type, id, options).catch(err => {
      // Be aware that `allOrNone` option in parallel mode
      // will not revert the other successful requests.
      // It only raises error when met at least one failed request.
      if (options.allOrNone || !err.errorCode) {
        throw err;
      }
      return toSaveResult(err);
    })));
  }

  /** @private */
  async _destroyMany(type, ids, options) {
    if (ids.length === 0) {
      return [];
    }
    if (ids.length > MAX_DML_COUNT && options.allowRecursive) {
      return [...(await this._destroyMany(type, (0, _slice.default)(ids).call(ids, 0, MAX_DML_COUNT), options)), ...(await this._destroyMany(type, (0, _slice.default)(ids).call(ids, MAX_DML_COUNT), options))];
    }
    let url = [this._baseUrl(), 'composite', 'sobjects?ids='].join('/') + ids.join(',');
    if (options.allOrNone) {
      url += '&allOrNone=true';
    }
    return this.request({
      method: 'DELETE',
      url,
      headers: options.headers || {}
    });
  }

  /**
   * Synonym of Connection#destroy()
   */

  /**
   * Synonym of Connection#destroy()
   */

  /**
   * Describe SObject metadata
   */
  async describe(type) {
    const url = [this._baseUrl(), 'sobjects', type, 'describe'].join('/');
    const body = await this.request(url);
    return body;
  }

  /**
   * Describe global SObjects
   */
  async describeGlobal() {
    const url = `${this._baseUrl()}/sobjects`;
    const body = await this.request(url);
    return body;
  }

  /**
   * Get SObject instance
   */

  sobject(type) {
    const so = this.sobjects[type] || new _sobject.default(this, type);
    this.sobjects[type] = so;
    return so;
  }

  /**
   * Get identity information of current user
   */
  async identity(options = {}) {
    let url = this.userInfo && this.userInfo.url;
    if (!url) {
      const res = await this.request({
        method: 'GET',
        url: this._baseUrl(),
        headers: options.headers
      });
      url = res.identity;
    }
    url += '?format=json';
    if (this.accessToken) {
      url += `&oauth_token=${encodeURIComponent(this.accessToken)}`;
    }
    const res = await this.request({
      method: 'GET',
      url
    });
    this.userInfo = {
      id: res.user_id,
      organizationId: res.organization_id,
      url: res.id
    };
    return res;
  }

  /**
   * List recently viewed records
   */
  async recent(type, limit) {
    /* eslint-disable no-param-reassign */
    if (typeof type === 'number') {
      limit = type;
      type = undefined;
    }
    let url;
    if (type) {
      url = [this._baseUrl(), 'sobjects', type].join('/');
      const {
        recentItems
      } = await this.request(url);
      return limit ? (0, _slice.default)(recentItems).call(recentItems, 0, limit) : recentItems;
    }
    url = `${this._baseUrl()}/recent`;
    if (limit) {
      url += `?limit=${limit}`;
    }
    return this.request(url);
  }

  /**
   * Retrieve updated records
   */
  async updated(type, start, end) {
    /* eslint-disable no-param-reassign */
    let url = [this._baseUrl(), 'sobjects', type, 'updated'].join('/');
    if (typeof start === 'string') {
      start = new Date(start);
    }
    start = (0, _formatter.formatDate)(start);
    url += `?start=${encodeURIComponent(start)}`;
    if (typeof end === 'string') {
      end = new Date(end);
    }
    end = (0, _formatter.formatDate)(end);
    url += `&end=${encodeURIComponent(end)}`;
    const body = await this.request(url);
    return body;
  }

  /**
   * Retrieve deleted records
   */
  async deleted(type, start, end) {
    /* eslint-disable no-param-reassign */
    let url = [this._baseUrl(), 'sobjects', type, 'deleted'].join('/');
    if (typeof start === 'string') {
      start = new Date(start);
    }
    start = (0, _formatter.formatDate)(start);
    url += `?start=${encodeURIComponent(start)}`;
    if (typeof end === 'string') {
      end = new Date(end);
    }
    end = (0, _formatter.formatDate)(end);
    url += `&end=${encodeURIComponent(end)}`;
    const body = await this.request(url);
    return body;
  }

  /**
   * Returns a list of all tabs
   */
  async tabs() {
    const url = [this._baseUrl(), 'tabs'].join('/');
    const body = await this.request(url);
    return body;
  }

  /**
   * Returns current system limit in the organization
   */
  async limits() {
    const url = [this._baseUrl(), 'limits'].join('/');
    const body = await this.request(url);
    return body;
  }

  /**
   * Returns a theme info
   */
  async theme() {
    const url = [this._baseUrl(), 'theme'].join('/');
    const body = await this.request(url);
    return body;
  }

  /**
   * Returns all registered global quick actions
   */
  async quickActions() {
    const body = await this.request('/quickActions');
    return body;
  }

  /**
   * Get reference for specified global quick action
   */
  quickAction(actionName) {
    return new _quickAction.default(this, `/quickActions/${actionName}`);
  }

  /**
   * Module which manages process rules and approval processes
   */
}
exports.Connection = Connection;
(0, _defineProperty2.default)(Connection, "_logger", (0, _logger.getLogger)('connection'));
var _default = Connection;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl9qc2ZvcmNlIiwiX2ludGVyb3BSZXF1aXJlRGVmYXVsdCIsIl90cmFuc3BvcnQiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9sb2dnZXIiLCJfb2F1dGgiLCJfY2FjaGUiLCJfaHR0cEFwaSIsIl9zZXNzaW9uUmVmcmVzaERlbGVnYXRlIiwiX3F1ZXJ5IiwiX3NvYmplY3QiLCJfcXVpY2tBY3Rpb24iLCJfcHJvY2VzcyIsIl9mb3JtYXR0ZXIiLCJfZm9ybURhdGEiLCJfdG9Qcm9wZXJ0eUtleSIsImFyZyIsImtleSIsIl90b1ByaW1pdGl2ZSIsIlN0cmluZyIsImlucHV0IiwiaGludCIsInByaW0iLCJfU3ltYm9sJHRvUHJpbWl0aXZlIiwidW5kZWZpbmVkIiwicmVzIiwiY2FsbCIsIlR5cGVFcnJvciIsIk51bWJlciIsIm93bktleXMiLCJvYmplY3QiLCJlbnVtZXJhYmxlT25seSIsImtleXMiLCJfT2JqZWN0JGtleXMiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eSIsInN5bSIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwiZW51bWVyYWJsZSIsInB1c2giLCJhcHBseSIsIl9vYmplY3RTcHJlYWQiLCJ0YXJnZXQiLCJpIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwic291cmNlIiwiX2NvbnRleHQ3IiwiX2ZvckVhY2hJbnN0YW5jZVByb3BlcnR5MiIsIk9iamVjdCIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQ4IiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsImRlZmF1bHRDb25uZWN0aW9uQ29uZmlnIiwibG9naW5VcmwiLCJpbnN0YW5jZVVybCIsInZlcnNpb24iLCJsb2dMZXZlbCIsIm1heFJlcXVlc3QiLCJlc2MiLCJzdHIiLCJyZXBsYWNlIiwicGFyc2VTaWduZWRSZXF1ZXN0Iiwic3IiLCJKU09OIiwicGFyc2UiLCJtc2ciLCJzcGxpdCIsInBvcCIsIkVycm9yIiwianNvbiIsIkJ1ZmZlciIsImZyb20iLCJ0b1N0cmluZyIsInBhcnNlSWRVcmwiLCJ1cmwiLCJfY29udGV4dCIsIm9yZ2FuaXphdGlvbklkIiwiaWQiLCJfc2xpY2UiLCJvYXV0aFJlZnJlc2hGbiIsImNvbm4iLCJjYWxsYmFjayIsInJlZnJlc2hUb2tlbiIsIm9hdXRoMiIsInVzZXJJbmZvIiwiX2VzdGFibGlzaCIsImluc3RhbmNlX3VybCIsImFjY2Vzc1Rva2VuIiwiYWNjZXNzX3Rva2VuIiwiZXJyIiwiY3JlYXRlVXNlcm5hbWVQYXNzd29yZFJlZnJlc2hGbiIsInVzZXJuYW1lIiwicGFzc3dvcmQiLCJsb2dpbiIsInRvU2F2ZVJlc3VsdCIsInN1Y2Nlc3MiLCJlcnJvcnMiLCJyYWlzZU5vTW9kdWxlRXJyb3IiLCJuYW1lIiwiTUFYX0RNTF9DT1VOVCIsIkNvbm5lY3Rpb24iLCJFdmVudEVtaXR0ZXIiLCJhbmFseXRpY3MiLCJhcGV4IiwiYnVsayIsImJ1bGsyIiwiY2hhdHRlciIsIm1ldGFkYXRhIiwic29hcCIsInN0cmVhbWluZyIsInRvb2xpbmciLCJjb25zdHJ1Y3RvciIsImNvbmZpZyIsImNyZWF0ZSIsImRlc3Ryb3kiLCJQcm9jZXNzIiwicHJveHlVcmwiLCJodHRwUHJveHkiLCJPQXV0aDIiLCJyZWZyZXNoRm4iLCJjbGllbnRJZCIsIl9yZWZyZXNoRGVsZWdhdGUiLCJTZXNzaW9uUmVmcmVzaERlbGVnYXRlIiwiX21heFJlcXVlc3QiLCJjcmVhdGVJbnN0YW5jZSIsIl9sb2dMZXZlbCIsIlhkUHJveHlUcmFuc3BvcnQiLCJIdHRwUHJveHlUcmFuc3BvcnQiLCJUcmFuc3BvcnQiLCJfY2FsbE9wdGlvbnMiLCJjYWxsT3B0aW9ucyIsImNhY2hlIiwiQ2FjaGUiLCJkZXNjcmliZUNhY2hlS2V5IiwidHlwZSIsImRlc2NyaWJlIiwicHJvdG90eXBlIiwiY3JlYXRlQ2FjaGVkRnVuY3Rpb24iLCJzdHJhdGVneSIsImRlc2NyaWJlJCIsImRlc2NyaWJlJCQiLCJkZXNjcmliZVNPYmplY3QiLCJkZXNjcmliZVNPYmplY3QkIiwiZGVzY3JpYmVTT2JqZWN0JCQiLCJkZXNjcmliZUdsb2JhbCIsImRlc2NyaWJlR2xvYmFsJCIsImRlc2NyaWJlR2xvYmFsJCQiLCJzZXNzaW9uSWQiLCJzZXJ2ZXJVcmwiLCJzaWduZWRSZXF1ZXN0IiwianNmb3JjZSIsImVtaXQiLCJvcHRpb25zIiwiX2NvbnRleHQyIiwiam9pbiIsInNpZ25lZFJlcXVlc3RPYmplY3QiLCJjbGllbnQiLCJvYXV0aFRva2VuIiwiQ2FudmFzVHJhbnNwb3J0Iiwic3VwcG9ydGVkIiwiX3Nlc3Npb25UeXBlIiwiX3Jlc2V0SW5zdGFuY2UiLCJfY2xlYXJTZXNzaW9uIiwibGltaXRJbmZvIiwic29iamVjdHMiLCJjbGVhciIsImdldCIsInJlbW92ZUFsbExpc3RlbmVycyIsIm9uIiwicmVzdWx0Iiwic28iLCJzb2JqZWN0IiwiYXV0aG9yaXplIiwiY29kZU9yUGFyYW1zIiwicGFyYW1zIiwicmVxdWVzdFRva2VuIiwicmVmcmVzaF90b2tlbiIsImRlYnVnIiwiY2xpZW50U2VjcmV0IiwibG9naW5CeU9BdXRoMiIsImxvZ2luQnlTb2FwIiwiYXV0aGVudGljYXRlIiwiaW5mbyIsIl9jb250ZXh0MyIsIl9wcm9taXNlIiwicmVqZWN0IiwiYm9keSIsInNvYXBMb2dpbkVuZHBvaW50IiwicmVzcG9uc2UiLCJodHRwUmVxdWVzdCIsIm1ldGhvZCIsImhlYWRlcnMiLCJTT0FQQWN0aW9uIiwibSIsInN0YXR1c0NvZGUiLCJtYXRjaCIsImZhdWx0c3RyaW5nIiwidXNlcklkIiwiaWRVcmwiLCJsb2dvdXQiLCJyZXZva2UiLCJsb2dvdXRCeU9BdXRoMiIsImxvZ291dEJ5U29hcCIsInRva2VuIiwicmV2b2tlVG9rZW4iLCJyZXF1ZXN0IiwicmVxdWVzdF8iLCJfbm9ybWFsaXplVXJsIiwiaHR0cEFwaSIsIkh0dHBBcGkiLCJhcGlVc2FnZSIsInVzZWQiLCJfcGFyc2VJbnQyIiwibGltaXQiLCJyZXF1ZXN0R2V0IiwicmVxdWVzdFBvc3QiLCJfc3RyaW5naWZ5IiwicmVxdWVzdFB1dCIsInJlcXVlc3RQYXRjaCIsInJlcXVlc3REZWxldGUiLCJfYmFzZVVybCIsIl9pbmRleE9mIiwicXVlcnkiLCJzb3FsIiwiUXVlcnkiLCJzZWFyY2giLCJzb3NsIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwicXVlcnlNb3JlIiwibG9jYXRvciIsIl9lbnN1cmVWZXJzaW9uIiwibWFqb3JWZXJzaW9uIiwidmVyc2lvbnMiLCJfc3VwcG9ydHMiLCJmZWF0dXJlIiwicmV0cmlldmUiLCJpZHMiLCJfaXNBcnJheSIsIl9yZXRyaWV2ZU1hbnkiLCJfcmV0cmlldmVQYXJhbGxlbCIsIl9yZXRyaWV2ZVNpbmdsZSIsImZpZWxkcyIsImFsbCIsIl9tYXAiLCJjYXRjaCIsImFsbE9yTm9uZSIsImVycm9yQ29kZSIsIl9jb250ZXh0NCIsImZpZWxkIiwicmVjb3JkcyIsInJldCIsIl9jcmVhdGVNYW55IiwiX2NyZWF0ZVBhcmFsbGVsIiwiX2NyZWF0ZVNpbmdsZSIsInJlY29yZCIsIklkIiwicnR5cGUiLCJhdHRyaWJ1dGVzIiwicmVjIiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzMiIsInNvYmplY3RUeXBlIiwiY29udGVudFR5cGUiLCJtdWx0aXBhcnRGaWxlRmllbGRzIiwiX2NvbnRleHQ1IiwiZm9ybSIsIkZvcm1EYXRhIiwiX2ZvckVhY2giLCJfZW50cmllcyIsImZpZWxkTmFtZSIsImZpbGVEZXRhaWxzIiwiYXBwZW5kIiwiZ2V0SGVhZGVycyIsInJlc29sdmUiLCJhbGxvd1JlY3Vyc2l2ZSIsIl9yZWNvcmRzIiwidXBkYXRlIiwiX3VwZGF0ZU1hbnkiLCJfdXBkYXRlUGFyYWxsZWwiLCJfdXBkYXRlU2luZ2xlIiwibm9Db250ZW50UmVzcG9uc2UiLCJ1cHNlcnQiLCJleHRJZEZpZWxkIiwiaXNBcnJheSIsInJlc3VsdHMiLCJfY29udGV4dDYiLCJleHRJZCIsIl9kZXN0cm95TWFueSIsIl9kZXN0cm95UGFyYWxsZWwiLCJfZGVzdHJveVNpbmdsZSIsIlNPYmplY3QiLCJpZGVudGl0eSIsInVzZXJfaWQiLCJvcmdhbml6YXRpb25faWQiLCJyZWNlbnQiLCJyZWNlbnRJdGVtcyIsInVwZGF0ZWQiLCJzdGFydCIsImVuZCIsIkRhdGUiLCJmb3JtYXREYXRlIiwiZGVsZXRlZCIsInRhYnMiLCJsaW1pdHMiLCJ0aGVtZSIsInF1aWNrQWN0aW9ucyIsInF1aWNrQWN0aW9uIiwiYWN0aW9uTmFtZSIsIlF1aWNrQWN0aW9uIiwiZXhwb3J0cyIsImdldExvZ2dlciIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vc3JjL2Nvbm5lY3Rpb24udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKlxuICovXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IGpzZm9yY2UgZnJvbSAnLi9qc2ZvcmNlJztcbmltcG9ydCB7XG4gIEh0dHBSZXF1ZXN0LFxuICBIdHRwUmVzcG9uc2UsXG4gIENhbGxiYWNrLFxuICBSZWNvcmQsXG4gIFNhdmVSZXN1bHQsXG4gIFVwc2VydFJlc3VsdCxcbiAgRGVzY3JpYmVHbG9iYWxSZXN1bHQsXG4gIERlc2NyaWJlU09iamVjdFJlc3VsdCxcbiAgRGVzY3JpYmVUYWIsXG4gIERlc2NyaWJlVGhlbWUsXG4gIERlc2NyaWJlUXVpY2tBY3Rpb25SZXN1bHQsXG4gIFVwZGF0ZWRSZXN1bHQsXG4gIERlbGV0ZWRSZXN1bHQsXG4gIFNlYXJjaFJlc3VsdCxcbiAgT3JnYW5pemF0aW9uTGltaXRzSW5mbyxcbiAgT3B0aW9uYWwsXG4gIFNpZ25lZFJlcXVlc3RPYmplY3QsXG4gIFNhdmVFcnJvcixcbiAgRG1sT3B0aW9ucyxcbiAgUmV0cmlldmVPcHRpb25zLFxuICBTY2hlbWEsXG4gIFNPYmplY3ROYW1lcyxcbiAgU09iamVjdElucHV0UmVjb3JkLFxuICBTT2JqZWN0VXBkYXRlUmVjb3JkLFxuICBTT2JqZWN0RmllbGROYW1lcyxcbiAgVXNlckluZm8sXG4gIElkZW50aXR5SW5mbyxcbiAgTGltaXRJbmZvLFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFN0cmVhbVByb21pc2UgfSBmcm9tICcuL3V0aWwvcHJvbWlzZSc7XG5pbXBvcnQgVHJhbnNwb3J0LCB7XG4gIENhbnZhc1RyYW5zcG9ydCxcbiAgWGRQcm94eVRyYW5zcG9ydCxcbiAgSHR0cFByb3h5VHJhbnNwb3J0LFxufSBmcm9tICcuL3RyYW5zcG9ydCc7XG5pbXBvcnQgeyBMb2dnZXIsIGdldExvZ2dlciB9IGZyb20gJy4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHsgTG9nTGV2ZWxDb25maWcgfSBmcm9tICcuL3V0aWwvbG9nZ2VyJztcbmltcG9ydCBPQXV0aDIsIHsgVG9rZW5SZXNwb25zZSB9IGZyb20gJy4vb2F1dGgyJztcbmltcG9ydCB7IE9BdXRoMkNvbmZpZyB9IGZyb20gJy4vb2F1dGgyJztcbmltcG9ydCBDYWNoZSwgeyBDYWNoZWRGdW5jdGlvbiB9IGZyb20gJy4vY2FjaGUnO1xuaW1wb3J0IEh0dHBBcGkgZnJvbSAnLi9odHRwLWFwaSc7XG5pbXBvcnQgU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZSwge1xuICBTZXNzaW9uUmVmcmVzaEZ1bmMsXG59IGZyb20gJy4vc2Vzc2lvbi1yZWZyZXNoLWRlbGVnYXRlJztcbmltcG9ydCBRdWVyeSBmcm9tICcuL3F1ZXJ5JztcbmltcG9ydCB7IFF1ZXJ5T3B0aW9ucyB9IGZyb20gJy4vcXVlcnknO1xuaW1wb3J0IFNPYmplY3QgZnJvbSAnLi9zb2JqZWN0JztcbmltcG9ydCBRdWlja0FjdGlvbiBmcm9tICcuL3F1aWNrLWFjdGlvbic7XG5pbXBvcnQgUHJvY2VzcyBmcm9tICcuL3Byb2Nlc3MnO1xuaW1wb3J0IHsgZm9ybWF0RGF0ZSB9IGZyb20gJy4vdXRpbC9mb3JtYXR0ZXInO1xuaW1wb3J0IEFuYWx5dGljcyBmcm9tICcuL2FwaS9hbmFseXRpY3MnO1xuaW1wb3J0IEFwZXggZnJvbSAnLi9hcGkvYXBleCc7XG5pbXBvcnQgeyBCdWxrLCBCdWxrVjIgfSBmcm9tICcuL2FwaS9idWxrJztcbmltcG9ydCBDaGF0dGVyIGZyb20gJy4vYXBpL2NoYXR0ZXInO1xuaW1wb3J0IE1ldGFkYXRhIGZyb20gJy4vYXBpL21ldGFkYXRhJztcbmltcG9ydCBTb2FwQXBpIGZyb20gJy4vYXBpL3NvYXAnO1xuaW1wb3J0IFN0cmVhbWluZyBmcm9tICcuL2FwaS9zdHJlYW1pbmcnO1xuaW1wb3J0IFRvb2xpbmcgZnJvbSAnLi9hcGkvdG9vbGluZyc7XG5pbXBvcnQgRm9ybURhdGEgZnJvbSAnZm9ybS1kYXRhJztcblxuLyoqXG4gKiB0eXBlIGRlZmluaXRpb25zXG4gKi9cbmV4cG9ydCB0eXBlIENvbm5lY3Rpb25Db25maWc8UyBleHRlbmRzIFNjaGVtYSA9IFNjaGVtYT4gPSB7XG4gIHZlcnNpb24/OiBzdHJpbmc7XG4gIGxvZ2luVXJsPzogc3RyaW5nO1xuICBhY2Nlc3NUb2tlbj86IHN0cmluZztcbiAgcmVmcmVzaFRva2VuPzogc3RyaW5nO1xuICBpbnN0YW5jZVVybD86IHN0cmluZztcbiAgc2Vzc2lvbklkPzogc3RyaW5nO1xuICBzZXJ2ZXJVcmw/OiBzdHJpbmc7XG4gIHNpZ25lZFJlcXVlc3Q/OiBzdHJpbmc7XG4gIG9hdXRoMj86IE9BdXRoMiB8IE9BdXRoMkNvbmZpZztcbiAgbWF4UmVxdWVzdD86IG51bWJlcjtcbiAgcHJveHlVcmw/OiBzdHJpbmc7XG4gIGh0dHBQcm94eT86IHN0cmluZztcbiAgbG9nTGV2ZWw/OiBMb2dMZXZlbENvbmZpZztcbiAgY2FsbE9wdGlvbnM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgcmVmcmVzaEZuPzogU2Vzc2lvblJlZnJlc2hGdW5jPFM+O1xufTtcblxuZXhwb3J0IHR5cGUgQ29ubmVjdGlvbkVzdGFibGlzaE9wdGlvbnMgPSB7XG4gIGFjY2Vzc1Rva2VuPzogT3B0aW9uYWw8c3RyaW5nPjtcbiAgcmVmcmVzaFRva2VuPzogT3B0aW9uYWw8c3RyaW5nPjtcbiAgaW5zdGFuY2VVcmw/OiBPcHRpb25hbDxzdHJpbmc+O1xuICBzZXNzaW9uSWQ/OiBPcHRpb25hbDxzdHJpbmc+O1xuICBzZXJ2ZXJVcmw/OiBPcHRpb25hbDxzdHJpbmc+O1xuICBzaWduZWRSZXF1ZXN0PzogT3B0aW9uYWw8c3RyaW5nIHwgU2lnbmVkUmVxdWVzdE9iamVjdD47XG4gIHVzZXJJbmZvPzogT3B0aW9uYWw8VXNlckluZm8+O1xufTtcblxuLyoqXG4gKlxuICovXG5jb25zdCBkZWZhdWx0Q29ubmVjdGlvbkNvbmZpZzoge1xuICBsb2dpblVybDogc3RyaW5nO1xuICBpbnN0YW5jZVVybDogc3RyaW5nO1xuICB2ZXJzaW9uOiBzdHJpbmc7XG4gIGxvZ0xldmVsOiBMb2dMZXZlbENvbmZpZztcbiAgbWF4UmVxdWVzdDogbnVtYmVyO1xufSA9IHtcbiAgbG9naW5Vcmw6ICdodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tJyxcbiAgaW5zdGFuY2VVcmw6ICcnLFxuICB2ZXJzaW9uOiAnNTAuMCcsXG4gIGxvZ0xldmVsOiAnTk9ORScsXG4gIG1heFJlcXVlc3Q6IDEwLFxufTtcblxuLyoqXG4gKlxuICovXG5mdW5jdGlvbiBlc2Moc3RyOiBPcHRpb25hbDxzdHJpbmc+KTogc3RyaW5nIHtcbiAgcmV0dXJuIFN0cmluZyhzdHIgfHwgJycpXG4gICAgLnJlcGxhY2UoLyYvZywgJyZhbXA7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG5cbi8qKlxuICpcbiAqL1xuZnVuY3Rpb24gcGFyc2VTaWduZWRSZXF1ZXN0KHNyOiBzdHJpbmcgfCBPYmplY3QpOiBTaWduZWRSZXF1ZXN0T2JqZWN0IHtcbiAgaWYgKHR5cGVvZiBzciA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAoc3JbMF0gPT09ICd7Jykge1xuICAgICAgLy8gbWlnaHQgYmUgSlNPTlxuICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3IpO1xuICAgIH0gLy8gbWlnaHQgYmUgb3JpZ2luYWwgYmFzZTY0LWVuY29kZWQgc2lnbmVkIHJlcXVlc3RcbiAgICBjb25zdCBtc2cgPSBzci5zcGxpdCgnLicpLnBvcCgpOyAvLyByZXRyaWV2ZSBsYXR0ZXIgcGFydFxuICAgIGlmICghbXNnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc2lnbmVkIHJlcXVlc3QnKTtcbiAgICB9XG4gICAgY29uc3QganNvbiA9IEJ1ZmZlci5mcm9tKG1zZywgJ2Jhc2U2NCcpLnRvU3RyaW5nKCd1dGYtOCcpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKGpzb24pO1xuICB9XG4gIHJldHVybiBzciBhcyBTaWduZWRSZXF1ZXN0T2JqZWN0O1xufVxuXG4vKiogQHByaXZhdGUgKiovXG5mdW5jdGlvbiBwYXJzZUlkVXJsKHVybDogc3RyaW5nKSB7XG4gIGNvbnN0IFtvcmdhbml6YXRpb25JZCwgaWRdID0gdXJsLnNwbGl0KCcvJykuc2xpY2UoLTIpO1xuICByZXR1cm4geyBpZCwgb3JnYW5pemF0aW9uSWQsIHVybCB9O1xufVxuXG4vKipcbiAqIFNlc3Npb24gUmVmcmVzaCBkZWxlZ2F0ZSBmdW5jdGlvbiBmb3IgT0F1dGgyIGF1dGh6IGNvZGUgZmxvd1xuICogQHByaXZhdGVcbiAqL1xuYXN5bmMgZnVuY3Rpb24gb2F1dGhSZWZyZXNoRm48UyBleHRlbmRzIFNjaGVtYT4oXG4gIGNvbm46IENvbm5lY3Rpb248Uz4sXG4gIGNhbGxiYWNrOiBDYWxsYmFjazxzdHJpbmcsIFRva2VuUmVzcG9uc2U+LFxuKSB7XG4gIHRyeSB7XG4gICAgaWYgKCFjb25uLnJlZnJlc2hUb2tlbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyByZWZyZXNoIHRva2VuIGZvdW5kIGluIHRoZSBjb25uZWN0aW9uJyk7XG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNvbm4ub2F1dGgyLnJlZnJlc2hUb2tlbihjb25uLnJlZnJlc2hUb2tlbik7XG4gICAgY29uc3QgdXNlckluZm8gPSBwYXJzZUlkVXJsKHJlcy5pZCk7XG4gICAgY29ubi5fZXN0YWJsaXNoKHtcbiAgICAgIGluc3RhbmNlVXJsOiByZXMuaW5zdGFuY2VfdXJsLFxuICAgICAgYWNjZXNzVG9rZW46IHJlcy5hY2Nlc3NfdG9rZW4sXG4gICAgICB1c2VySW5mbyxcbiAgICB9KTtcbiAgICBjYWxsYmFjayh1bmRlZmluZWQsIHJlcy5hY2Nlc3NfdG9rZW4sIHJlcyk7XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFNlc3Npb24gUmVmcmVzaCBkZWxlZ2F0ZSBmdW5jdGlvbiBmb3IgdXNlcm5hbWUvcGFzc3dvcmQgbG9naW5cbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVVzZXJuYW1lUGFzc3dvcmRSZWZyZXNoRm48UyBleHRlbmRzIFNjaGVtYT4oXG4gIHVzZXJuYW1lOiBzdHJpbmcsXG4gIHBhc3N3b3JkOiBzdHJpbmcsXG4pIHtcbiAgcmV0dXJuIGFzeW5jIChcbiAgICBjb25uOiBDb25uZWN0aW9uPFM+LFxuICAgIGNhbGxiYWNrOiBDYWxsYmFjazxzdHJpbmcsIFRva2VuUmVzcG9uc2U+LFxuICApID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgY29ubi5sb2dpbih1c2VybmFtZSwgcGFzc3dvcmQpO1xuICAgICAgaWYgKCFjb25uLmFjY2Vzc1Rva2VuKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWNjZXNzIHRva2VuIG5vdCBmb3VuZCBhZnRlciBsb2dpbicpO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2sobnVsbCwgY29ubi5hY2Nlc3NUb2tlbik7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gdG9TYXZlUmVzdWx0KGVycjogU2F2ZUVycm9yKTogU2F2ZVJlc3VsdCB7XG4gIHJldHVybiB7XG4gICAgc3VjY2VzczogZmFsc2UsXG4gICAgZXJyb3JzOiBbZXJyXSxcbiAgfTtcbn1cblxuLyoqXG4gKlxuICovXG5mdW5jdGlvbiByYWlzZU5vTW9kdWxlRXJyb3IobmFtZTogc3RyaW5nKTogbmV2ZXIge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgYEFQSSBtb2R1bGUgJyR7bmFtZX0nIGlzIG5vdCBsb2FkZWQsIGxvYWQgJ2pzZm9yY2UvYXBpLyR7bmFtZX0nIGV4cGxpY2l0bHlgLFxuICApO1xufVxuXG4vKlxuICogQ29uc3RhbnQgb2YgbWF4aW11bSByZWNvcmRzIG51bSBpbiBETUwgb3BlcmF0aW9uICh1cGRhdGUvZGVsZXRlKVxuICovXG5jb25zdCBNQVhfRE1MX0NPVU5UID0gMjAwO1xuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBjbGFzcyBDb25uZWN0aW9uPFMgZXh0ZW5kcyBTY2hlbWEgPSBTY2hlbWE+IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgc3RhdGljIF9sb2dnZXIgPSBnZXRMb2dnZXIoJ2Nvbm5lY3Rpb24nKTtcblxuICB2ZXJzaW9uOiBzdHJpbmc7XG4gIGxvZ2luVXJsOiBzdHJpbmc7XG4gIGluc3RhbmNlVXJsOiBzdHJpbmc7XG4gIGFjY2Vzc1Rva2VuOiBPcHRpb25hbDxzdHJpbmc+O1xuICByZWZyZXNoVG9rZW46IE9wdGlvbmFsPHN0cmluZz47XG4gIHVzZXJJbmZvOiBPcHRpb25hbDxVc2VySW5mbz47XG4gIGxpbWl0SW5mbzogTGltaXRJbmZvID0ge307XG4gIG9hdXRoMjogT0F1dGgyO1xuICBzb2JqZWN0czogeyBbTiBpbiBTT2JqZWN0TmFtZXM8Uz5dPzogU09iamVjdDxTLCBOPiB9ID0ge307XG4gIGNhY2hlOiBDYWNoZTtcbiAgX2NhbGxPcHRpb25zOiBPcHRpb25hbDx7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfT47XG4gIF9tYXhSZXF1ZXN0OiBudW1iZXI7XG4gIF9sb2dnZXI6IExvZ2dlcjtcbiAgX2xvZ0xldmVsOiBPcHRpb25hbDxMb2dMZXZlbENvbmZpZz47XG4gIF90cmFuc3BvcnQ6IFRyYW5zcG9ydDtcbiAgX3Nlc3Npb25UeXBlOiBPcHRpb25hbDwnc29hcCcgfCAnb2F1dGgyJz47XG4gIF9yZWZyZXNoRGVsZWdhdGU6IE9wdGlvbmFsPFNlc3Npb25SZWZyZXNoRGVsZWdhdGU8Uz4+O1xuXG4gIC8vIGRlc2NyaWJlOiAobmFtZTogc3RyaW5nKSA9PiBQcm9taXNlPERlc2NyaWJlU09iamVjdFJlc3VsdD47XG4gIGRlc2NyaWJlJDogQ2FjaGVkRnVuY3Rpb248KG5hbWU6IHN0cmluZykgPT4gUHJvbWlzZTxEZXNjcmliZVNPYmplY3RSZXN1bHQ+PjtcbiAgZGVzY3JpYmUkJDogQ2FjaGVkRnVuY3Rpb248KG5hbWU6IHN0cmluZykgPT4gRGVzY3JpYmVTT2JqZWN0UmVzdWx0PjtcbiAgZGVzY3JpYmVTT2JqZWN0OiAobmFtZTogc3RyaW5nKSA9PiBQcm9taXNlPERlc2NyaWJlU09iamVjdFJlc3VsdD47XG4gIGRlc2NyaWJlU09iamVjdCQ6IENhY2hlZEZ1bmN0aW9uPFxuICAgIChuYW1lOiBzdHJpbmcpID0+IFByb21pc2U8RGVzY3JpYmVTT2JqZWN0UmVzdWx0PlxuICA+O1xuICBkZXNjcmliZVNPYmplY3QkJDogQ2FjaGVkRnVuY3Rpb248KG5hbWU6IHN0cmluZykgPT4gRGVzY3JpYmVTT2JqZWN0UmVzdWx0PjtcbiAgLy8gZGVzY3JpYmVHbG9iYWw6ICgpID0+IFByb21pc2U8RGVzY3JpYmVHbG9iYWxSZXN1bHQ+O1xuICBkZXNjcmliZUdsb2JhbCQ6IENhY2hlZEZ1bmN0aW9uPCgpID0+IFByb21pc2U8RGVzY3JpYmVHbG9iYWxSZXN1bHQ+PjtcbiAgZGVzY3JpYmVHbG9iYWwkJDogQ2FjaGVkRnVuY3Rpb248KCkgPT4gRGVzY3JpYmVHbG9iYWxSZXN1bHQ+O1xuXG4gIC8vIEFQSSBsaWJzIGFyZSBub3QgaW5zdGFudGlhdGVkIGhlcmUgc28gdGhhdCBjb3JlIG1vZHVsZSB0byByZW1haW4gd2l0aG91dCBkZXBlbmRlbmNpZXMgdG8gdGhlbVxuICAvLyBJdCBpcyByZXNwb25zaWJsZSBmb3IgZGV2ZWxvcGVycyB0byBpbXBvcnQgYXBpIGxpYnMgZXhwbGljaXRseSBpZiB0aGV5IGFyZSB1c2luZyAnanNmb3JjZS9jb3JlJyBpbnN0ZWFkIG9mICdqc2ZvcmNlJy5cbiAgZ2V0IGFuYWx5dGljcygpOiBBbmFseXRpY3M8Uz4ge1xuICAgIHJldHVybiByYWlzZU5vTW9kdWxlRXJyb3IoJ2FuYWx5dGljcycpO1xuICB9XG5cbiAgZ2V0IGFwZXgoKTogQXBleDxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignYXBleCcpO1xuICB9XG5cbiAgZ2V0IGJ1bGsoKTogQnVsazxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignYnVsaycpO1xuICB9XG5cbiAgZ2V0IGJ1bGsyKCk6IEJ1bGtWMjxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignYnVsazInKTtcbiAgfVxuXG4gIGdldCBjaGF0dGVyKCk6IENoYXR0ZXI8Uz4ge1xuICAgIHJldHVybiByYWlzZU5vTW9kdWxlRXJyb3IoJ2NoYXR0ZXInKTtcbiAgfVxuXG4gIGdldCBtZXRhZGF0YSgpOiBNZXRhZGF0YTxTPiB7XG4gICAgcmV0dXJuIHJhaXNlTm9Nb2R1bGVFcnJvcignbWV0YWRhdGEnKTtcbiAgfVxuXG4gIGdldCBzb2FwKCk6IFNvYXBBcGk8Uz4ge1xuICAgIHJldHVybiByYWlzZU5vTW9kdWxlRXJyb3IoJ3NvYXAnKTtcbiAgfVxuXG4gIGdldCBzdHJlYW1pbmcoKTogU3RyZWFtaW5nPFM+IHtcbiAgICByZXR1cm4gcmFpc2VOb01vZHVsZUVycm9yKCdzdHJlYW1pbmcnKTtcbiAgfVxuXG4gIGdldCB0b29saW5nKCk6IFRvb2xpbmc8Uz4ge1xuICAgIHJldHVybiByYWlzZU5vTW9kdWxlRXJyb3IoJ3Rvb2xpbmcnKTtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgY29uc3RydWN0b3IoY29uZmlnOiBDb25uZWN0aW9uQ29uZmlnPFM+ID0ge30pIHtcbiAgICBzdXBlcigpO1xuICAgIGNvbnN0IHtcbiAgICAgIGxvZ2luVXJsLFxuICAgICAgaW5zdGFuY2VVcmwsXG4gICAgICB2ZXJzaW9uLFxuICAgICAgb2F1dGgyLFxuICAgICAgbWF4UmVxdWVzdCxcbiAgICAgIGxvZ0xldmVsLFxuICAgICAgcHJveHlVcmwsXG4gICAgICBodHRwUHJveHksXG4gICAgfSA9IGNvbmZpZztcbiAgICB0aGlzLmxvZ2luVXJsID0gbG9naW5VcmwgfHwgZGVmYXVsdENvbm5lY3Rpb25Db25maWcubG9naW5Vcmw7XG4gICAgdGhpcy5pbnN0YW5jZVVybCA9IGluc3RhbmNlVXJsIHx8IGRlZmF1bHRDb25uZWN0aW9uQ29uZmlnLmluc3RhbmNlVXJsO1xuICAgIHRoaXMudmVyc2lvbiA9IHZlcnNpb24gfHwgZGVmYXVsdENvbm5lY3Rpb25Db25maWcudmVyc2lvbjtcbiAgICB0aGlzLm9hdXRoMiA9XG4gICAgICBvYXV0aDIgaW5zdGFuY2VvZiBPQXV0aDJcbiAgICAgICAgPyBvYXV0aDJcbiAgICAgICAgOiBuZXcgT0F1dGgyKHtcbiAgICAgICAgICAgIGxvZ2luVXJsOiB0aGlzLmxvZ2luVXJsLFxuICAgICAgICAgICAgcHJveHlVcmwsXG4gICAgICAgICAgICBodHRwUHJveHksXG4gICAgICAgICAgICAuLi5vYXV0aDIsXG4gICAgICAgICAgfSk7XG4gICAgbGV0IHJlZnJlc2hGbiA9IGNvbmZpZy5yZWZyZXNoRm47XG4gICAgaWYgKCFyZWZyZXNoRm4gJiYgdGhpcy5vYXV0aDIuY2xpZW50SWQpIHtcbiAgICAgIHJlZnJlc2hGbiA9IG9hdXRoUmVmcmVzaEZuO1xuICAgIH1cbiAgICBpZiAocmVmcmVzaEZuKSB7XG4gICAgICB0aGlzLl9yZWZyZXNoRGVsZWdhdGUgPSBuZXcgU2Vzc2lvblJlZnJlc2hEZWxlZ2F0ZSh0aGlzLCByZWZyZXNoRm4pO1xuICAgIH1cbiAgICB0aGlzLl9tYXhSZXF1ZXN0ID0gbWF4UmVxdWVzdCB8fCBkZWZhdWx0Q29ubmVjdGlvbkNvbmZpZy5tYXhSZXF1ZXN0O1xuICAgIHRoaXMuX2xvZ2dlciA9IGxvZ0xldmVsXG4gICAgICA/IENvbm5lY3Rpb24uX2xvZ2dlci5jcmVhdGVJbnN0YW5jZShsb2dMZXZlbClcbiAgICAgIDogQ29ubmVjdGlvbi5fbG9nZ2VyO1xuICAgIHRoaXMuX2xvZ0xldmVsID0gbG9nTGV2ZWw7XG4gICAgdGhpcy5fdHJhbnNwb3J0ID0gcHJveHlVcmxcbiAgICAgID8gbmV3IFhkUHJveHlUcmFuc3BvcnQocHJveHlVcmwpXG4gICAgICA6IGh0dHBQcm94eVxuICAgICAgPyBuZXcgSHR0cFByb3h5VHJhbnNwb3J0KGh0dHBQcm94eSlcbiAgICAgIDogbmV3IFRyYW5zcG9ydCgpO1xuICAgIHRoaXMuX2NhbGxPcHRpb25zID0gY29uZmlnLmNhbGxPcHRpb25zO1xuICAgIHRoaXMuY2FjaGUgPSBuZXcgQ2FjaGUoKTtcbiAgICBjb25zdCBkZXNjcmliZUNhY2hlS2V5ID0gKHR5cGU/OiBzdHJpbmcpID0+XG4gICAgICB0eXBlID8gYGRlc2NyaWJlLiR7dHlwZX1gIDogJ2Rlc2NyaWJlJztcbiAgICBjb25zdCBkZXNjcmliZSA9IENvbm5lY3Rpb24ucHJvdG90eXBlLmRlc2NyaWJlO1xuICAgIHRoaXMuZGVzY3JpYmUgPSB0aGlzLmNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKGRlc2NyaWJlLCB0aGlzLCB7XG4gICAgICBrZXk6IGRlc2NyaWJlQ2FjaGVLZXksXG4gICAgICBzdHJhdGVneTogJ05PQ0FDSEUnLFxuICAgIH0pO1xuICAgIHRoaXMuZGVzY3JpYmUkID0gdGhpcy5jYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihkZXNjcmliZSwgdGhpcywge1xuICAgICAga2V5OiBkZXNjcmliZUNhY2hlS2V5LFxuICAgICAgc3RyYXRlZ3k6ICdISVQnLFxuICAgIH0pO1xuICAgIHRoaXMuZGVzY3JpYmUkJCA9IHRoaXMuY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oZGVzY3JpYmUsIHRoaXMsIHtcbiAgICAgIGtleTogZGVzY3JpYmVDYWNoZUtleSxcbiAgICAgIHN0cmF0ZWd5OiAnSU1NRURJQVRFJyxcbiAgICB9KSBhcyBhbnk7XG4gICAgdGhpcy5kZXNjcmliZVNPYmplY3QgPSB0aGlzLmRlc2NyaWJlO1xuICAgIHRoaXMuZGVzY3JpYmVTT2JqZWN0JCA9IHRoaXMuZGVzY3JpYmUkO1xuICAgIHRoaXMuZGVzY3JpYmVTT2JqZWN0JCQgPSB0aGlzLmRlc2NyaWJlJCQ7XG4gICAgY29uc3QgZGVzY3JpYmVHbG9iYWwgPSBDb25uZWN0aW9uLnByb3RvdHlwZS5kZXNjcmliZUdsb2JhbDtcbiAgICB0aGlzLmRlc2NyaWJlR2xvYmFsID0gdGhpcy5jYWNoZS5jcmVhdGVDYWNoZWRGdW5jdGlvbihcbiAgICAgIGRlc2NyaWJlR2xvYmFsLFxuICAgICAgdGhpcyxcbiAgICAgIHsga2V5OiAnZGVzY3JpYmVHbG9iYWwnLCBzdHJhdGVneTogJ05PQ0FDSEUnIH0sXG4gICAgKTtcbiAgICB0aGlzLmRlc2NyaWJlR2xvYmFsJCA9IHRoaXMuY2FjaGUuY3JlYXRlQ2FjaGVkRnVuY3Rpb24oXG4gICAgICBkZXNjcmliZUdsb2JhbCxcbiAgICAgIHRoaXMsXG4gICAgICB7IGtleTogJ2Rlc2NyaWJlR2xvYmFsJywgc3RyYXRlZ3k6ICdISVQnIH0sXG4gICAgKTtcbiAgICB0aGlzLmRlc2NyaWJlR2xvYmFsJCQgPSB0aGlzLmNhY2hlLmNyZWF0ZUNhY2hlZEZ1bmN0aW9uKFxuICAgICAgZGVzY3JpYmVHbG9iYWwsXG4gICAgICB0aGlzLFxuICAgICAgeyBrZXk6ICdkZXNjcmliZUdsb2JhbCcsIHN0cmF0ZWd5OiAnSU1NRURJQVRFJyB9LFxuICAgICkgYXMgYW55O1xuICAgIGNvbnN0IHtcbiAgICAgIGFjY2Vzc1Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuLFxuICAgICAgc2Vzc2lvbklkLFxuICAgICAgc2VydmVyVXJsLFxuICAgICAgc2lnbmVkUmVxdWVzdCxcbiAgICB9ID0gY29uZmlnO1xuICAgIHRoaXMuX2VzdGFibGlzaCh7XG4gICAgICBhY2Nlc3NUb2tlbixcbiAgICAgIHJlZnJlc2hUb2tlbixcbiAgICAgIGluc3RhbmNlVXJsLFxuICAgICAgc2Vzc2lvbklkLFxuICAgICAgc2VydmVyVXJsLFxuICAgICAgc2lnbmVkUmVxdWVzdCxcbiAgICB9KTtcblxuICAgIGpzZm9yY2UuZW1pdCgnY29ubmVjdGlvbjpuZXcnLCB0aGlzKTtcbiAgfVxuXG4gIC8qIEBwcml2YXRlICovXG4gIF9lc3RhYmxpc2gob3B0aW9uczogQ29ubmVjdGlvbkVzdGFibGlzaE9wdGlvbnMpIHtcbiAgICBjb25zdCB7XG4gICAgICBhY2Nlc3NUb2tlbixcbiAgICAgIHJlZnJlc2hUb2tlbixcbiAgICAgIGluc3RhbmNlVXJsLFxuICAgICAgc2Vzc2lvbklkLFxuICAgICAgc2VydmVyVXJsLFxuICAgICAgc2lnbmVkUmVxdWVzdCxcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0gPSBvcHRpb25zO1xuICAgIHRoaXMuaW5zdGFuY2VVcmwgPSBzZXJ2ZXJVcmxcbiAgICAgID8gc2VydmVyVXJsLnNwbGl0KCcvJykuc2xpY2UoMCwgMykuam9pbignLycpXG4gICAgICA6IGluc3RhbmNlVXJsIHx8IHRoaXMuaW5zdGFuY2VVcmw7XG4gICAgdGhpcy5hY2Nlc3NUb2tlbiA9IHNlc3Npb25JZCB8fCBhY2Nlc3NUb2tlbiB8fCB0aGlzLmFjY2Vzc1Rva2VuO1xuICAgIHRoaXMucmVmcmVzaFRva2VuID0gcmVmcmVzaFRva2VuIHx8IHRoaXMucmVmcmVzaFRva2VuO1xuICAgIGlmICh0aGlzLnJlZnJlc2hUb2tlbiAmJiAhdGhpcy5fcmVmcmVzaERlbGVnYXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdSZWZyZXNoIHRva2VuIGlzIHNwZWNpZmllZCB3aXRob3V0IG9hdXRoMiBjbGllbnQgaW5mb3JtYXRpb24gb3IgcmVmcmVzaCBmdW5jdGlvbicsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBzaWduZWRSZXF1ZXN0T2JqZWN0ID1cbiAgICAgIHNpZ25lZFJlcXVlc3QgJiYgcGFyc2VTaWduZWRSZXF1ZXN0KHNpZ25lZFJlcXVlc3QpO1xuICAgIGlmIChzaWduZWRSZXF1ZXN0T2JqZWN0KSB7XG4gICAgICB0aGlzLmFjY2Vzc1Rva2VuID0gc2lnbmVkUmVxdWVzdE9iamVjdC5jbGllbnQub2F1dGhUb2tlbjtcbiAgICAgIGlmIChDYW52YXNUcmFuc3BvcnQuc3VwcG9ydGVkKSB7XG4gICAgICAgIHRoaXMuX3RyYW5zcG9ydCA9IG5ldyBDYW52YXNUcmFuc3BvcnQoc2lnbmVkUmVxdWVzdE9iamVjdCk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMudXNlckluZm8gPSB1c2VySW5mbyB8fCB0aGlzLnVzZXJJbmZvO1xuICAgIHRoaXMuX3Nlc3Npb25UeXBlID0gc2Vzc2lvbklkID8gJ3NvYXAnIDogJ29hdXRoMic7XG4gICAgdGhpcy5fcmVzZXRJbnN0YW5jZSgpO1xuICB9XG5cbiAgLyogQHByaXZlYXRlICovXG4gIF9jbGVhclNlc3Npb24oKSB7XG4gICAgdGhpcy5hY2Nlc3NUb2tlbiA9IG51bGw7XG4gICAgdGhpcy5yZWZyZXNoVG9rZW4gPSBudWxsO1xuICAgIHRoaXMuaW5zdGFuY2VVcmwgPSBkZWZhdWx0Q29ubmVjdGlvbkNvbmZpZy5pbnN0YW5jZVVybDtcbiAgICB0aGlzLnVzZXJJbmZvID0gbnVsbDtcbiAgICB0aGlzLl9zZXNzaW9uVHlwZSA9IG51bGw7XG4gIH1cblxuICAvKiBAcHJpdmVhdGUgKi9cbiAgX3Jlc2V0SW5zdGFuY2UoKSB7XG4gICAgdGhpcy5saW1pdEluZm8gPSB7fTtcbiAgICB0aGlzLnNvYmplY3RzID0ge307XG4gICAgLy8gVE9ETyBpbXBsIGNhY2hlXG4gICAgdGhpcy5jYWNoZS5jbGVhcigpO1xuICAgIHRoaXMuY2FjaGUuZ2V0KCdkZXNjcmliZUdsb2JhbCcpLnJlbW92ZUFsbExpc3RlbmVycygndmFsdWUnKTtcbiAgICB0aGlzLmNhY2hlLmdldCgnZGVzY3JpYmVHbG9iYWwnKS5vbigndmFsdWUnLCAoeyByZXN1bHQgfSkgPT4ge1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBmb3IgKGNvbnN0IHNvIG9mIHJlc3VsdC5zb2JqZWN0cykge1xuICAgICAgICAgIHRoaXMuc29iamVjdChzby5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIC8qXG4gICAgaWYgKHRoaXMudG9vbGluZykge1xuICAgICAgdGhpcy50b29saW5nLl9yZXNldEluc3RhbmNlKCk7XG4gICAgfVxuICAgICovXG4gIH1cblxuICAvKipcbiAgICogQXV0aG9yaXplIHRoZSBjb25uZWN0aW9uIHVzaW5nIE9BdXRoMiBmbG93LlxuICAgKiBUeXBpY2FsbHksIGp1c3QgcGFzcyB0aGUgY29kZSByZXR1cm5lZCBmcm9tIGF1dGhvcml6YXRpb24gc2VydmVyIGluIHRoZSBmaXJzdCBhcmd1bWVudCB0byBjb21wbGV0ZSBhdXRob3JpemF0aW9uLlxuICAgKiBJZiB5b3Ugd2FudCB0byBhdXRob3JpemUgd2l0aCBncmFudCB0eXBlcyBvdGhlciB0aGFuIGBhdXRob3JpemF0aW9uX2NvZGVgLCB5b3UgY2FuIGFsc28gcGFzcyBwYXJhbXMgb2JqZWN0IHdpdGggdGhlIGdyYW50IHR5cGUuXG4gICAqXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPFVzZXJJbmZvPn0gQW4gb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlIHVzZXIgSUQsIG9yZyBJRCBhbmQgaWRlbnRpdHkgVVJMLlxuICAgKlxuICAgKi9cbiAgYXN5bmMgYXV0aG9yaXplKFxuICAgIGNvZGVPclBhcmFtczogc3RyaW5nIHwgeyBncmFudF90eXBlOiBzdHJpbmc7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSxcbiAgICBwYXJhbXM6IHsgW25hbWU6IHN0cmluZ106IHN0cmluZyB9ID0ge30sXG4gICk6IFByb21pc2U8VXNlckluZm8+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm9hdXRoMi5yZXF1ZXN0VG9rZW4oY29kZU9yUGFyYW1zLCBwYXJhbXMpO1xuICAgIGNvbnN0IHVzZXJJbmZvID0gcGFyc2VJZFVybChyZXMuaWQpO1xuICAgIHRoaXMuX2VzdGFibGlzaCh7XG4gICAgICBpbnN0YW5jZVVybDogcmVzLmluc3RhbmNlX3VybCxcbiAgICAgIGFjY2Vzc1Rva2VuOiByZXMuYWNjZXNzX3Rva2VuLFxuICAgICAgcmVmcmVzaFRva2VuOiByZXMucmVmcmVzaF90b2tlbixcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGA8bG9naW4+IGNvbXBsZXRlZC4gdXNlciBpZCA9ICR7dXNlckluZm8uaWR9LCBvcmcgaWQgPSAke3VzZXJJbmZvLm9yZ2FuaXphdGlvbklkfWAsXG4gICAgKTtcbiAgICByZXR1cm4gdXNlckluZm87XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIGFzeW5jIGxvZ2luKHVzZXJuYW1lOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPFVzZXJJbmZvPiB7XG4gICAgdGhpcy5fcmVmcmVzaERlbGVnYXRlID0gbmV3IFNlc3Npb25SZWZyZXNoRGVsZWdhdGUoXG4gICAgICB0aGlzLFxuICAgICAgY3JlYXRlVXNlcm5hbWVQYXNzd29yZFJlZnJlc2hGbih1c2VybmFtZSwgcGFzc3dvcmQpLFxuICAgICk7XG4gICAgaWYgKHRoaXMub2F1dGgyICYmIHRoaXMub2F1dGgyLmNsaWVudElkICYmIHRoaXMub2F1dGgyLmNsaWVudFNlY3JldCkge1xuICAgICAgcmV0dXJuIHRoaXMubG9naW5CeU9BdXRoMih1c2VybmFtZSwgcGFzc3dvcmQpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2dpbkJ5U29hcCh1c2VybmFtZSwgcGFzc3dvcmQpO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZ2luIGJ5IE9BdXRoMiB1c2VybmFtZSAmIHBhc3N3b3JkIGZsb3dcbiAgICovXG4gIGFzeW5jIGxvZ2luQnlPQXV0aDIodXNlcm5hbWU6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8VXNlckluZm8+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm9hdXRoMi5hdXRoZW50aWNhdGUodXNlcm5hbWUsIHBhc3N3b3JkKTtcbiAgICBjb25zdCB1c2VySW5mbyA9IHBhcnNlSWRVcmwocmVzLmlkKTtcbiAgICB0aGlzLl9lc3RhYmxpc2goe1xuICAgICAgaW5zdGFuY2VVcmw6IHJlcy5pbnN0YW5jZV91cmwsXG4gICAgICBhY2Nlc3NUb2tlbjogcmVzLmFjY2Vzc190b2tlbixcbiAgICAgIHVzZXJJbmZvLFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5pbmZvKFxuICAgICAgYDxsb2dpbj4gY29tcGxldGVkLiB1c2VyIGlkID0gJHt1c2VySW5mby5pZH0sIG9yZyBpZCA9ICR7dXNlckluZm8ub3JnYW5pemF0aW9uSWR9YCxcbiAgICApO1xuICAgIHJldHVybiB1c2VySW5mbztcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgYXN5bmMgbG9naW5CeVNvYXAodXNlcm5hbWU6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8VXNlckluZm8+IHtcbiAgICBpZiAoIXVzZXJuYW1lIHx8ICFwYXNzd29yZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignbm8gdXNlcm5hbWUgcGFzc3dvcmQgZ2l2ZW4nKSk7XG4gICAgfVxuICAgIGNvbnN0IGJvZHkgPSBbXG4gICAgICAnPHNlOkVudmVsb3BlIHhtbG5zOnNlPVwiaHR0cDovL3NjaGVtYXMueG1sc29hcC5vcmcvc29hcC9lbnZlbG9wZS9cIj4nLFxuICAgICAgJzxzZTpIZWFkZXIvPicsXG4gICAgICAnPHNlOkJvZHk+JyxcbiAgICAgICc8bG9naW4geG1sbnM9XCJ1cm46cGFydG5lci5zb2FwLnNmb3JjZS5jb21cIj4nLFxuICAgICAgYDx1c2VybmFtZT4ke2VzYyh1c2VybmFtZSl9PC91c2VybmFtZT5gLFxuICAgICAgYDxwYXNzd29yZD4ke2VzYyhwYXNzd29yZCl9PC9wYXNzd29yZD5gLFxuICAgICAgJzwvbG9naW4+JyxcbiAgICAgICc8L3NlOkJvZHk+JyxcbiAgICAgICc8L3NlOkVudmVsb3BlPicsXG4gICAgXS5qb2luKCcnKTtcblxuICAgIGNvbnN0IHNvYXBMb2dpbkVuZHBvaW50ID0gW1xuICAgICAgdGhpcy5sb2dpblVybCxcbiAgICAgICdzZXJ2aWNlcy9Tb2FwL3UnLFxuICAgICAgdGhpcy52ZXJzaW9uLFxuICAgIF0uam9pbignLycpO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fdHJhbnNwb3J0Lmh0dHBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsOiBzb2FwTG9naW5FbmRwb2ludCxcbiAgICAgIGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnLFxuICAgICAgICBTT0FQQWN0aW9uOiAnXCJcIicsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIGxldCBtO1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgbSA9IHJlc3BvbnNlLmJvZHkubWF0Y2goLzxmYXVsdHN0cmluZz4oW148XSspPFxcL2ZhdWx0c3RyaW5nPi8pO1xuICAgICAgY29uc3QgZmF1bHRzdHJpbmcgPSBtICYmIG1bMV07XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZmF1bHRzdHJpbmcgfHwgcmVzcG9uc2UuYm9keSk7XG4gICAgfVxuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhgU09BUCByZXNwb25zZSA9ICR7cmVzcG9uc2UuYm9keX1gKTtcbiAgICBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPHNlcnZlclVybD4oW148XSspPFxcL3NlcnZlclVybD4vKTtcbiAgICBjb25zdCBzZXJ2ZXJVcmwgPSBtICYmIG1bMV07XG4gICAgbSA9IHJlc3BvbnNlLmJvZHkubWF0Y2goLzxzZXNzaW9uSWQ+KFtePF0rKTxcXC9zZXNzaW9uSWQ+Lyk7XG4gICAgY29uc3Qgc2Vzc2lvbklkID0gbSAmJiBtWzFdO1xuICAgIG0gPSByZXNwb25zZS5ib2R5Lm1hdGNoKC88dXNlcklkPihbXjxdKyk8XFwvdXNlcklkPi8pO1xuICAgIGNvbnN0IHVzZXJJZCA9IG0gJiYgbVsxXTtcbiAgICBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPG9yZ2FuaXphdGlvbklkPihbXjxdKyk8XFwvb3JnYW5pemF0aW9uSWQ+Lyk7XG4gICAgY29uc3Qgb3JnYW5pemF0aW9uSWQgPSBtICYmIG1bMV07XG4gICAgaWYgKCFzZXJ2ZXJVcmwgfHwgIXNlc3Npb25JZCB8fCAhdXNlcklkIHx8ICFvcmdhbml6YXRpb25JZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnY291bGQgbm90IGV4dHJhY3Qgc2Vzc2lvbiBpbmZvcm1hdGlvbiBmcm9tIGxvZ2luIHJlc3BvbnNlJyxcbiAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IGlkVXJsID0gW3RoaXMubG9naW5VcmwsICdpZCcsIG9yZ2FuaXphdGlvbklkLCB1c2VySWRdLmpvaW4oJy8nKTtcbiAgICBjb25zdCB1c2VySW5mbyA9IHsgaWQ6IHVzZXJJZCwgb3JnYW5pemF0aW9uSWQsIHVybDogaWRVcmwgfTtcbiAgICB0aGlzLl9lc3RhYmxpc2goe1xuICAgICAgc2VydmVyVXJsOiBzZXJ2ZXJVcmwuc3BsaXQoJy8nKS5zbGljZSgwLCAzKS5qb2luKCcvJyksXG4gICAgICBzZXNzaW9uSWQsXG4gICAgICB1c2VySW5mbyxcbiAgICB9KTtcbiAgICB0aGlzLl9sb2dnZXIuaW5mbyhcbiAgICAgIGA8bG9naW4+IGNvbXBsZXRlZC4gdXNlciBpZCA9ICR7dXNlcklkfSwgb3JnIGlkID0gJHtvcmdhbml6YXRpb25JZH1gLFxuICAgICk7XG4gICAgcmV0dXJuIHVzZXJJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIExvZ291dCB0aGUgY3VycmVudCBzZXNzaW9uXG4gICAqL1xuICBhc3luYyBsb2dvdXQocmV2b2tlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuX3JlZnJlc2hEZWxlZ2F0ZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAodGhpcy5fc2Vzc2lvblR5cGUgPT09ICdvYXV0aDInKSB7XG4gICAgICByZXR1cm4gdGhpcy5sb2dvdXRCeU9BdXRoMihyZXZva2UpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5sb2dvdXRCeVNvYXAocmV2b2tlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dvdXQgdGhlIGN1cnJlbnQgc2Vzc2lvbiBieSByZXZva2luZyBhY2Nlc3MgdG9rZW4gdmlhIE9BdXRoMiBzZXNzaW9uIHJldm9rZVxuICAgKi9cbiAgYXN5bmMgbG9nb3V0QnlPQXV0aDIocmV2b2tlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRva2VuID0gcmV2b2tlID8gdGhpcy5yZWZyZXNoVG9rZW4gOiB0aGlzLmFjY2Vzc1Rva2VuO1xuICAgIGlmICh0b2tlbikge1xuICAgICAgYXdhaXQgdGhpcy5vYXV0aDIucmV2b2tlVG9rZW4odG9rZW4pO1xuICAgIH1cbiAgICAvLyBEZXN0cm95IHRoZSBzZXNzaW9uIGJvdW5kIHRvIHRoaXMgY29ubmVjdGlvblxuICAgIHRoaXMuX2NsZWFyU2Vzc2lvbigpO1xuICAgIHRoaXMuX3Jlc2V0SW5zdGFuY2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMb2dvdXQgdGhlIHNlc3Npb24gYnkgdXNpbmcgU09BUCB3ZWIgc2VydmljZSBBUElcbiAgICovXG4gIGFzeW5jIGxvZ291dEJ5U29hcChyZXZva2U/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYm9keSA9IFtcbiAgICAgICc8c2U6RW52ZWxvcGUgeG1sbnM6c2U9XCJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy9zb2FwL2VudmVsb3BlL1wiPicsXG4gICAgICAnPHNlOkhlYWRlcj4nLFxuICAgICAgJzxTZXNzaW9uSGVhZGVyIHhtbG5zPVwidXJuOnBhcnRuZXIuc29hcC5zZm9yY2UuY29tXCI+JyxcbiAgICAgIGA8c2Vzc2lvbklkPiR7ZXNjKFxuICAgICAgICByZXZva2UgPyB0aGlzLnJlZnJlc2hUb2tlbiA6IHRoaXMuYWNjZXNzVG9rZW4sXG4gICAgICApfTwvc2Vzc2lvbklkPmAsXG4gICAgICAnPC9TZXNzaW9uSGVhZGVyPicsXG4gICAgICAnPC9zZTpIZWFkZXI+JyxcbiAgICAgICc8c2U6Qm9keT4nLFxuICAgICAgJzxsb2dvdXQgeG1sbnM9XCJ1cm46cGFydG5lci5zb2FwLnNmb3JjZS5jb21cIi8+JyxcbiAgICAgICc8L3NlOkJvZHk+JyxcbiAgICAgICc8L3NlOkVudmVsb3BlPicsXG4gICAgXS5qb2luKCcnKTtcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX3RyYW5zcG9ydC5odHRwUmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHVybDogW3RoaXMuaW5zdGFuY2VVcmwsICdzZXJ2aWNlcy9Tb2FwL3UnLCB0aGlzLnZlcnNpb25dLmpvaW4oJy8nKSxcbiAgICAgIGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC94bWwnLFxuICAgICAgICBTT0FQQWN0aW9uOiAnXCJcIicsXG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgIGBTT0FQIHN0YXR1c0NvZGUgPSAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9LCByZXNwb25zZSA9ICR7cmVzcG9uc2UuYm9keX1gLFxuICAgICk7XG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1c0NvZGUgPj0gNDAwKSB7XG4gICAgICBjb25zdCBtID0gcmVzcG9uc2UuYm9keS5tYXRjaCgvPGZhdWx0c3RyaW5nPihbXjxdKyk8XFwvZmF1bHRzdHJpbmc+Lyk7XG4gICAgICBjb25zdCBmYXVsdHN0cmluZyA9IG0gJiYgbVsxXTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihmYXVsdHN0cmluZyB8fCByZXNwb25zZS5ib2R5KTtcbiAgICB9XG4gICAgLy8gRGVzdHJveSB0aGUgc2Vzc2lvbiBib3VuZCB0byB0aGlzIGNvbm5lY3Rpb25cbiAgICB0aGlzLl9jbGVhclNlc3Npb24oKTtcbiAgICB0aGlzLl9yZXNldEluc3RhbmNlKCk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBSRVNUIEFQSSByZXF1ZXN0IHdpdGggZ2l2ZW4gSFRUUCByZXF1ZXN0IGluZm8sIHdpdGggY29ubmVjdGVkIHNlc3Npb24gaW5mb3JtYXRpb24uXG4gICAqXG4gICAqIEVuZHBvaW50IFVSTCBjYW4gYmUgYWJzb2x1dGUgVVJMICgnaHR0cHM6Ly9uYTEuc2FsZXNmb3JjZS5jb20vc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCByZWxhdGl2ZSBwYXRoIGZyb20gcm9vdCAoJy9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIG9yIHJlbGF0aXZlIHBhdGggZnJvbSB2ZXJzaW9uIHJvb3QgKCcvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpLlxuICAgKi9cbiAgcmVxdWVzdDxSID0gdW5rbm93bj4oXG4gICAgcmVxdWVzdDogc3RyaW5nIHwgSHR0cFJlcXVlc3QsXG4gICAgb3B0aW9uczogT2JqZWN0ID0ge30sXG4gICk6IFN0cmVhbVByb21pc2U8Uj4ge1xuICAgIC8vIGlmIHJlcXVlc3QgaXMgc2ltcGxlIHN0cmluZywgcmVnYXJkIGl0IGFzIHVybCBpbiBHRVQgbWV0aG9kXG4gICAgbGV0IHJlcXVlc3RfOiBIdHRwUmVxdWVzdCA9XG4gICAgICB0eXBlb2YgcmVxdWVzdCA9PT0gJ3N0cmluZycgPyB7IG1ldGhvZDogJ0dFVCcsIHVybDogcmVxdWVzdCB9IDogcmVxdWVzdDtcbiAgICAvLyBpZiB1cmwgaXMgZ2l2ZW4gaW4gcmVsYXRpdmUgcGF0aCwgcHJlcGVuZCBiYXNlIHVybCBvciBpbnN0YW5jZSB1cmwgYmVmb3JlLlxuICAgIHJlcXVlc3RfID0ge1xuICAgICAgLi4ucmVxdWVzdF8sXG4gICAgICB1cmw6IHRoaXMuX25vcm1hbGl6ZVVybChyZXF1ZXN0Xy51cmwpLFxuICAgIH07XG4gICAgY29uc3QgaHR0cEFwaSA9IG5ldyBIdHRwQXBpKHRoaXMsIG9wdGlvbnMpO1xuICAgIC8vIGxvZyBhcGkgdXNhZ2UgYW5kIGl0cyBxdW90YVxuICAgIGh0dHBBcGkub24oJ3Jlc3BvbnNlJywgKHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChyZXNwb25zZS5oZWFkZXJzICYmIHJlc3BvbnNlLmhlYWRlcnNbJ3Nmb3JjZS1saW1pdC1pbmZvJ10pIHtcbiAgICAgICAgY29uc3QgYXBpVXNhZ2UgPSByZXNwb25zZS5oZWFkZXJzWydzZm9yY2UtbGltaXQtaW5mbyddLm1hdGNoKFxuICAgICAgICAgIC9hcGktdXNhZ2U9KFxcZCspXFwvKFxcZCspLyxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGFwaVVzYWdlKSB7XG4gICAgICAgICAgdGhpcy5saW1pdEluZm8gPSB7XG4gICAgICAgICAgICBhcGlVc2FnZToge1xuICAgICAgICAgICAgICB1c2VkOiBwYXJzZUludChhcGlVc2FnZVsxXSwgMTApLFxuICAgICAgICAgICAgICBsaW1pdDogcGFyc2VJbnQoYXBpVXNhZ2VbMl0sIDEwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBodHRwQXBpLnJlcXVlc3Q8Uj4ocmVxdWVzdF8pO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBHRVQgcmVxdWVzdFxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RHZXQ8UiA9IHVua25vd24+KHVybDogc3RyaW5nLCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7IG1ldGhvZDogJ0dFVCcsIHVybCB9O1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8Uj4ocmVxdWVzdCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBIVFRQIFBPU1QgcmVxdWVzdCB3aXRoIEpTT04gYm9keSwgd2l0aCBjb25uZWN0ZWQgc2Vzc2lvbiBpbmZvcm1hdGlvblxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RQb3N0PFIgPSB1bmtub3duPih1cmw6IHN0cmluZywgYm9keTogT2JqZWN0LCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7XG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIHVybCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFI+KHJlcXVlc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBQVVQgcmVxdWVzdCB3aXRoIEpTT04gYm9keSwgd2l0aCBjb25uZWN0ZWQgc2Vzc2lvbiBpbmZvcm1hdGlvblxuICAgKlxuICAgKiBFbmRwb2ludCBVUkwgY2FuIGJlIGFic29sdXRlIFVSTCAoJ2h0dHBzOi8vbmExLnNhbGVzZm9yY2UuY29tL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgcmVsYXRpdmUgcGF0aCBmcm9tIHJvb3QgKCcvc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCBvciByZWxhdGl2ZSBwYXRoIGZyb20gdmVyc2lvbiByb290ICgnL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKS5cbiAgICovXG4gIHJlcXVlc3RQdXQ8Uj4odXJsOiBzdHJpbmcsIGJvZHk6IE9iamVjdCwgb3B0aW9ucz86IE9iamVjdCkge1xuICAgIGNvbnN0IHJlcXVlc3Q6IEh0dHBSZXF1ZXN0ID0ge1xuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIHVybCxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgaGVhZGVyczogeyAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFI+KHJlcXVlc3QsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgSFRUUCBQQVRDSCByZXF1ZXN0IHdpdGggSlNPTiBib2R5XG4gICAqXG4gICAqIEVuZHBvaW50IFVSTCBjYW4gYmUgYWJzb2x1dGUgVVJMICgnaHR0cHM6Ly9uYTEuc2FsZXNmb3JjZS5jb20vc2VydmljZXMvZGF0YS92MzIuMC9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJylcbiAgICogLCByZWxhdGl2ZSBwYXRoIGZyb20gcm9vdCAoJy9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIG9yIHJlbGF0aXZlIHBhdGggZnJvbSB2ZXJzaW9uIHJvb3QgKCcvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpLlxuICAgKi9cbiAgcmVxdWVzdFBhdGNoPFIgPSB1bmtub3duPih1cmw6IHN0cmluZywgYm9keTogT2JqZWN0LCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7XG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShib2R5KSxcbiAgICAgIGhlYWRlcnM6IHsgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxSPihyZXF1ZXN0LCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIEhUVFAgREVMRVRFIHJlcXVlc3RcbiAgICpcbiAgICogRW5kcG9pbnQgVVJMIGNhbiBiZSBhYnNvbHV0ZSBVUkwgKCdodHRwczovL25hMS5zYWxlc2ZvcmNlLmNvbS9zZXJ2aWNlcy9kYXRhL3YzMi4wL3NvYmplY3RzL0FjY291bnQvZGVzY3JpYmUnKVxuICAgKiAsIHJlbGF0aXZlIHBhdGggZnJvbSByb290ICgnL3NlcnZpY2VzL2RhdGEvdjMyLjAvc29iamVjdHMvQWNjb3VudC9kZXNjcmliZScpXG4gICAqICwgb3IgcmVsYXRpdmUgcGF0aCBmcm9tIHZlcnNpb24gcm9vdCAoJy9zb2JqZWN0cy9BY2NvdW50L2Rlc2NyaWJlJykuXG4gICAqL1xuICByZXF1ZXN0RGVsZXRlPFI+KHVybDogc3RyaW5nLCBvcHRpb25zPzogT2JqZWN0KSB7XG4gICAgY29uc3QgcmVxdWVzdDogSHR0cFJlcXVlc3QgPSB7IG1ldGhvZDogJ0RFTEVURScsIHVybCB9O1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8Uj4ocmVxdWVzdCwgb3B0aW9ucyk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKiovXG4gIF9iYXNlVXJsKCkge1xuICAgIHJldHVybiBbdGhpcy5pbnN0YW5jZVVybCwgJ3NlcnZpY2VzL2RhdGEnLCBgdiR7dGhpcy52ZXJzaW9ufWBdLmpvaW4oJy8nKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IHBhdGggdG8gYWJzb2x1dGUgdXJsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfbm9ybWFsaXplVXJsKHVybDogc3RyaW5nKSB7XG4gICAgaWYgKHVybFswXSA9PT0gJy8nKSB7XG4gICAgICBpZiAodXJsLmluZGV4T2YodGhpcy5pbnN0YW5jZVVybCArICcvc2VydmljZXMvJykgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICAgIH1cbiAgICAgIGlmICh1cmwuaW5kZXhPZignL3NlcnZpY2VzLycpID09PSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlVXJsICsgdXJsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuX2Jhc2VVcmwoKSArIHVybDtcbiAgICB9XG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG4gIC8qKlxuICAgKlxuICAgKi9cbiAgcXVlcnk8VCBleHRlbmRzIFJlY29yZD4oXG4gICAgc29xbDogc3RyaW5nLFxuICAgIG9wdGlvbnM/OiBQYXJ0aWFsPFF1ZXJ5T3B0aW9ucz4sXG4gICk6IFF1ZXJ5PFMsIFNPYmplY3ROYW1lczxTPiwgVCwgJ1F1ZXJ5UmVzdWx0Jz4ge1xuICAgIHJldHVybiBuZXcgUXVlcnk8UywgU09iamVjdE5hbWVzPFM+LCBULCAnUXVlcnlSZXN1bHQnPih0aGlzLCBzb3FsLCBvcHRpb25zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIHNlYXJjaCBieSBTT1NMXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzb3NsIC0gU09TTCBzdHJpbmdcbiAgICogQHBhcmFtIHtDYWxsYmFjay48QXJyYXkuPFJlY29yZFJlc3VsdD4+fSBbY2FsbGJhY2tdIC0gQ2FsbGJhY2sgZnVuY3Rpb25cbiAgICogQHJldHVybnMge1Byb21pc2UuPEFycmF5LjxSZWNvcmRSZXN1bHQ+Pn1cbiAgICovXG4gIHNlYXJjaChzb3NsOiBzdHJpbmcpIHtcbiAgICB2YXIgdXJsID0gdGhpcy5fYmFzZVVybCgpICsgJy9zZWFyY2g/cT0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHNvc2wpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8U2VhcmNoUmVzdWx0Pih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBxdWVyeU1vcmUobG9jYXRvcjogc3RyaW5nLCBvcHRpb25zPzogUXVlcnlPcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBRdWVyeTxTLCBTT2JqZWN0TmFtZXM8Uz4sIFJlY29yZCwgJ1F1ZXJ5UmVzdWx0Jz4oXG4gICAgICB0aGlzLFxuICAgICAgeyBsb2NhdG9yIH0sXG4gICAgICBvcHRpb25zLFxuICAgICk7XG4gIH1cblxuICAvKiAqL1xuICBfZW5zdXJlVmVyc2lvbihtYWpvclZlcnNpb246IG51bWJlcikge1xuICAgIGNvbnN0IHZlcnNpb25zID0gdGhpcy52ZXJzaW9uLnNwbGl0KCcuJyk7XG4gICAgcmV0dXJuIHBhcnNlSW50KHZlcnNpb25zWzBdLCAxMCkgPj0gbWFqb3JWZXJzaW9uO1xuICB9XG5cbiAgLyogKi9cbiAgX3N1cHBvcnRzKGZlYXR1cmU6IHN0cmluZykge1xuICAgIHN3aXRjaCAoZmVhdHVyZSkge1xuICAgICAgY2FzZSAnc29iamVjdC1jb2xsZWN0aW9uJzogLy8gc29iamVjdCBjb2xsZWN0aW9uIGlzIGF2YWlsYWJsZSBvbmx5IGluIEFQSSB2ZXIgNDIuMCtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Vuc3VyZVZlcnNpb24oNDIpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBzcGVjaWZpZWQgcmVjb3Jkc1xuICAgKi9cbiAgcmV0cmlldmU8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyxcbiAgICBvcHRpb25zPzogUmV0cmlldmVPcHRpb25zLFxuICApOiBQcm9taXNlPFJlY29yZD47XG4gIHJldHJpZXZlPE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4+KFxuICAgIHR5cGU6IE4sXG4gICAgaWRzOiBzdHJpbmdbXSxcbiAgICBvcHRpb25zPzogUmV0cmlldmVPcHRpb25zLFxuICApOiBQcm9taXNlPFJlY29yZFtdPjtcbiAgcmV0cmlldmU8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBSZXRyaWV2ZU9wdGlvbnMsXG4gICk6IFByb21pc2U8UmVjb3JkIHwgUmVjb3JkW10+O1xuICBhc3luYyByZXRyaWV2ZShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBSZXRyaWV2ZU9wdGlvbnMgPSB7fSxcbiAgKSB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaWRzKVxuICAgICAgPyAvLyBjaGVjayB0aGUgdmVyc2lvbiB3aGV0aGVyIFNPYmplY3QgY29sbGVjdGlvbiBBUEkgaXMgc3VwcG9ydGVkICg0Mi4wKVxuICAgICAgICB0aGlzLl9lbnN1cmVWZXJzaW9uKDQyKVxuICAgICAgICA/IHRoaXMuX3JldHJpZXZlTWFueSh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fcmV0cmlldmVQYXJhbGxlbCh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICA6IHRoaXMuX3JldHJpZXZlU2luZ2xlKHR5cGUsIGlkcywgb3B0aW9ucyk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX3JldHJpZXZlU2luZ2xlKHR5cGU6IHN0cmluZywgaWQ6IHN0cmluZywgb3B0aW9uczogUmV0cmlldmVPcHRpb25zKSB7XG4gICAgaWYgKCFpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHJlY29yZCBJRC4gU3BlY2lmeSB2YWxpZCByZWNvcmQgSUQgdmFsdWUnKTtcbiAgICB9XG4gICAgbGV0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdzb2JqZWN0cycsIHR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgY29uc3QgeyBmaWVsZHMsIGhlYWRlcnMgfSA9IG9wdGlvbnM7XG4gICAgaWYgKGZpZWxkcykge1xuICAgICAgdXJsICs9IGA/ZmllbGRzPSR7ZmllbGRzLmpvaW4oJywnKX1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHsgbWV0aG9kOiAnR0VUJywgdXJsLCBoZWFkZXJzIH0pO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9yZXRyaWV2ZVBhcmFsbGVsKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBpZHM6IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM6IFJldHJpZXZlT3B0aW9ucyxcbiAgKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgaWRzLm1hcCgoaWQpID0+XG4gICAgICAgIHRoaXMuX3JldHJpZXZlU2luZ2xlKHR5cGUsIGlkLCBvcHRpb25zKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lIHx8IGVyci5lcnJvckNvZGUgIT09ICdOT1RfRk9VTkQnKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfcmV0cmlldmVNYW55KHR5cGU6IHN0cmluZywgaWRzOiBzdHJpbmdbXSwgb3B0aW9uczogUmV0cmlldmVPcHRpb25zKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ2NvbXBvc2l0ZScsICdzb2JqZWN0cycsIHR5cGVdLmpvaW4oJy8nKTtcbiAgICBjb25zdCBmaWVsZHMgPVxuICAgICAgb3B0aW9ucy5maWVsZHMgfHxcbiAgICAgIChhd2FpdCB0aGlzLmRlc2NyaWJlJCh0eXBlKSkuZmllbGRzLm1hcCgoZmllbGQpID0+IGZpZWxkLm5hbWUpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGlkcywgZmllbGRzIH0pLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIHJlY29yZHNcbiAgICovXG4gIGNyZWF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+XG4gID4oXG4gICAgdHlwZTogTixcbiAgICByZWNvcmRzOiBJbnB1dFJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIGNyZWF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+XG4gID4odHlwZTogTiwgcmVjb3JkOiBJbnB1dFJlY29yZCwgb3B0aW9ucz86IERtbE9wdGlvbnMpOiBQcm9taXNlPFNhdmVSZXN1bHQ+O1xuICBjcmVhdGU8XG4gICAgTiBleHRlbmRzIFNPYmplY3ROYW1lczxTPixcbiAgICBJbnB1dFJlY29yZCBleHRlbmRzIFNPYmplY3RJbnB1dFJlY29yZDxTLCBOPiA9IFNPYmplY3RJbnB1dFJlY29yZDxTLCBOPlxuICA+KFxuICAgIHR5cGU6IE4sXG4gICAgcmVjb3JkczogSW5wdXRSZWNvcmQgfCBJbnB1dFJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIHJlY29yZHNcbiAgICogQHBhcmFtIG9wdGlvbnNcbiAgICovXG4gIGFzeW5jIGNyZWF0ZShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgcmVjb3JkczogUmVjb3JkIHwgUmVjb3JkW10sXG4gICAgb3B0aW9uczogRG1sT3B0aW9ucyA9IHt9LFxuICApIHtcbiAgICBjb25zdCByZXQgPSBBcnJheS5pc0FycmF5KHJlY29yZHMpXG4gICAgICA/IC8vIGNoZWNrIHRoZSB2ZXJzaW9uIHdoZXRoZXIgU09iamVjdCBjb2xsZWN0aW9uIEFQSSBpcyBzdXBwb3J0ZWQgKDQyLjApXG4gICAgICAgIHRoaXMuX2Vuc3VyZVZlcnNpb24oNDIpXG4gICAgICAgID8gYXdhaXQgdGhpcy5fY3JlYXRlTWFueSh0eXBlLCByZWNvcmRzLCBvcHRpb25zKVxuICAgICAgICA6IGF3YWl0IHRoaXMuX2NyZWF0ZVBhcmFsbGVsKHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpXG4gICAgICA6IGF3YWl0IHRoaXMuX2NyZWF0ZVNpbmdsZSh0eXBlLCByZWNvcmRzLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9jcmVhdGVTaW5nbGUodHlwZTogc3RyaW5nLCByZWNvcmQ6IFJlY29yZCwgb3B0aW9uczogRG1sT3B0aW9ucykge1xuICAgIGNvbnN0IHsgSWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICBjb25zdCBzb2JqZWN0VHlwZSA9IHR5cGUgfHwgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy50eXBlKSB8fCBydHlwZTtcbiAgICBpZiAoIXNvYmplY3RUeXBlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIFNPYmplY3QgVHlwZSBkZWZpbmVkIGluIHJlY29yZCcpO1xuICAgIH1cbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCBzb2JqZWN0VHlwZV0uam9pbignLycpO1xuICAgIGxldCBjb250ZW50VHlwZSwgYm9keTtcblxuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMubXVsdGlwYXJ0RmlsZUZpZWxkcykge1xuICAgICAgLy8gU2VuZCB0aGUgcmVjb3JkIGFzIGEgbXVsdGlwYXJ0L2Zvcm0tZGF0YSByZXF1ZXN0LiBVc2VmdWwgZm9yIGZpZWxkcyBjb250YWluaW5nIGxhcmdlIGJpbmFyeSBibG9icy5cbiAgICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgIC8vIEV4dHJhY3QgdGhlIGZpZWxkcyByZXF1ZXN0ZWQgdG8gYmUgc2VudCBzZXBhcmF0ZWx5IGZyb20gdGhlIEpTT05cbiAgICAgIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMubXVsdGlwYXJ0RmlsZUZpZWxkcykuZm9yRWFjaChcbiAgICAgICAgKFtmaWVsZE5hbWUsIGZpbGVEZXRhaWxzXSkgPT4ge1xuICAgICAgICAgIGZvcm0uYXBwZW5kKFxuICAgICAgICAgICAgZmllbGROYW1lLFxuICAgICAgICAgICAgQnVmZmVyLmZyb20ocmVjW2ZpZWxkTmFtZV0sICdiYXNlNjQnKSxcbiAgICAgICAgICAgIGZpbGVEZXRhaWxzLFxuICAgICAgICAgICk7XG4gICAgICAgICAgZGVsZXRlIHJlY1tmaWVsZE5hbWVdO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICAgIC8vIFNlcmlhbGl6ZSB0aGUgcmVtYWluaW5nIGZpZWxkcyBhcyBKU09OXG4gICAgICBmb3JtLmFwcGVuZCh0eXBlLCBKU09OLnN0cmluZ2lmeShyZWMpLCB7XG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICB9KTtcbiAgICAgIGNvbnRlbnRUeXBlID0gZm9ybS5nZXRIZWFkZXJzKClbJ2NvbnRlbnQtdHlwZSddOyAvLyBUaGlzIGlzIG5lY2Vzc2FyeSB0byBlbnN1cmUgdGhlICdib3VuZGFyeScgaXMgcHJlc2VudFxuICAgICAgYm9keSA9IGZvcm07XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZmF1bHQgYmVoYXZpb3I6IHNlbmQgdGhlIHJlcXVlc3QgYXMgSlNPTlxuICAgICAgY29udGVudFR5cGUgPSAnYXBwbGljYXRpb24vanNvbic7XG4gICAgICBib2R5ID0gSlNPTi5zdHJpbmdpZnkocmVjKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsLFxuICAgICAgYm9keTogYm9keSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgLi4uKG9wdGlvbnMuaGVhZGVycyB8fCB7fSksXG4gICAgICAgICdjb250ZW50LXR5cGUnOiBjb250ZW50VHlwZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX2NyZWF0ZVBhcmFsbGVsKHR5cGU6IHN0cmluZywgcmVjb3JkczogUmVjb3JkW10sIG9wdGlvbnM6IERtbE9wdGlvbnMpIHtcbiAgICBpZiAocmVjb3Jkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgcmVjb3Jkcy5tYXAoKHJlY29yZCkgPT5cbiAgICAgICAgdGhpcy5fY3JlYXRlU2luZ2xlKHR5cGUsIHJlY29yZCwgb3B0aW9ucykuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIC8vIGJlIGF3YXJlIHRoYXQgYWxsT3JOb25lIGluIHBhcmFsbGVsIG1vZGUgd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzXG4gICAgICAgICAgLy8gaXQgb25seSByYWlzZXMgZXJyb3Igd2hlbiBtZXQgYXQgbGVhc3Qgb25lIGZhaWxlZCByZXF1ZXN0LlxuICAgICAgICAgIGlmIChvcHRpb25zLmFsbE9yTm9uZSB8fCAhZXJyLmVycm9yQ29kZSkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdG9TYXZlUmVzdWx0KGVycik7XG4gICAgICAgIH0pLFxuICAgICAgKSxcbiAgICApO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9jcmVhdGVNYW55KFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICByZWNvcmRzOiBSZWNvcmRbXSxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT4ge1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG4gICAgfVxuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX2NyZWF0ZU1hbnkoXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICByZWNvcmRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fY3JlYXRlTWFueShcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHJlY29yZHMuc2xpY2UoTUFYX0RNTF9DT1VOVCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBjb25zdCBfcmVjb3JkcyA9IHJlY29yZHMubWFwKChyZWNvcmQpID0+IHtcbiAgICAgIGNvbnN0IHsgSWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICAgIGNvbnN0IHNvYmplY3RUeXBlID0gdHlwZSB8fCAoYXR0cmlidXRlcyAmJiBhdHRyaWJ1dGVzLnR5cGUpIHx8IHJ0eXBlO1xuICAgICAgaWYgKCFzb2JqZWN0VHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIFNPYmplY3QgVHlwZSBkZWZpbmVkIGluIHJlY29yZCcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsgYXR0cmlidXRlczogeyB0eXBlOiBzb2JqZWN0VHlwZSB9LCAuLi5yZWMgfTtcbiAgICB9KTtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnY29tcG9zaXRlJywgJ3NvYmplY3RzJ10uam9pbignLycpO1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFsbE9yTm9uZTogb3B0aW9ucy5hbGxPck5vbmUgfHwgZmFsc2UsXG4gICAgICAgIHJlY29yZHM6IF9yZWNvcmRzLFxuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIENvbm5lY3Rpb24jY3JlYXRlKClcbiAgICovXG4gIGluc2VydCA9IHRoaXMuY3JlYXRlO1xuXG4gIC8qKlxuICAgKiBVcGRhdGUgcmVjb3Jkc1xuICAgKi9cbiAgdXBkYXRlPFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgVXBkYXRlUmVjb3JkIGV4dGVuZHMgU09iamVjdFVwZGF0ZVJlY29yZDxTLCBOPiA9IFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFVwZGF0ZVJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHRbXT47XG4gIHVwZGF0ZTxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIFVwZGF0ZVJlY29yZCBleHRlbmRzIFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj4gPSBTT2JqZWN0VXBkYXRlUmVjb3JkPFMsIE4+XG4gID4odHlwZTogTiwgcmVjb3JkOiBVcGRhdGVSZWNvcmQsIG9wdGlvbnM/OiBEbWxPcHRpb25zKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgdXBkYXRlPFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgVXBkYXRlUmVjb3JkIGV4dGVuZHMgU09iamVjdFVwZGF0ZVJlY29yZDxTLCBOPiA9IFNPYmplY3RVcGRhdGVSZWNvcmQ8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFVwZGF0ZVJlY29yZCB8IFVwZGF0ZVJlY29yZFtdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIHJlY29yZHNcbiAgICogQHBhcmFtIG9wdGlvbnNcbiAgICovXG4gIHVwZGF0ZTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IFJlY29yZCB8IFJlY29yZFtdLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMgPSB7fSxcbiAgKTogUHJvbWlzZTxTYXZlUmVzdWx0IHwgU2F2ZVJlc3VsdFtdPiB7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocmVjb3JkcylcbiAgICAgID8gLy8gY2hlY2sgdGhlIHZlcnNpb24gd2hldGhlciBTT2JqZWN0IGNvbGxlY3Rpb24gQVBJIGlzIHN1cHBvcnRlZCAoNDIuMClcbiAgICAgICAgdGhpcy5fZW5zdXJlVmVyc2lvbig0MilcbiAgICAgICAgPyB0aGlzLl91cGRhdGVNYW55KHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fdXBkYXRlUGFyYWxsZWwodHlwZSwgcmVjb3Jkcywgb3B0aW9ucylcbiAgICAgIDogdGhpcy5fdXBkYXRlU2luZ2xlKHR5cGUsIHJlY29yZHMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF91cGRhdGVTaW5nbGUoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZDogUmVjb3JkLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHsgSWQ6IGlkLCB0eXBlOiBydHlwZSwgYXR0cmlidXRlcywgLi4ucmVjIH0gPSByZWNvcmQ7XG4gICAgaWYgKCFpZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSZWNvcmQgaWQgaXMgbm90IGZvdW5kIGluIHJlY29yZC4nKTtcbiAgICB9XG4gICAgY29uc3Qgc29iamVjdFR5cGUgPSB0eXBlIHx8IChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMudHlwZSkgfHwgcnR5cGU7XG4gICAgaWYgKCFzb2JqZWN0VHlwZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBTT2JqZWN0IFR5cGUgZGVmaW5lZCBpbiByZWNvcmQnKTtcbiAgICB9XG4gICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgc29iamVjdFR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiAnUEFUQ0gnLFxuICAgICAgICB1cmwsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlYyksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSxcbiAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgbm9Db250ZW50UmVzcG9uc2U6IHsgaWQsIHN1Y2Nlc3M6IHRydWUsIGVycm9yczogW10gfSxcbiAgICAgIH0sXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfdXBkYXRlUGFyYWxsZWwodHlwZTogc3RyaW5nLCByZWNvcmRzOiBSZWNvcmRbXSwgb3B0aW9uczogRG1sT3B0aW9ucykge1xuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IHRoaXMuX21heFJlcXVlc3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhjZWVkZWQgbWF4IGxpbWl0IG9mIGNvbmN1cnJlbnQgY2FsbCcpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICByZWNvcmRzLm1hcCgocmVjb3JkKSA9PlxuICAgICAgICB0aGlzLl91cGRhdGVTaW5nbGUodHlwZSwgcmVjb3JkLCBvcHRpb25zKS5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgLy8gYmUgYXdhcmUgdGhhdCBhbGxPck5vbmUgaW4gcGFyYWxsZWwgbW9kZSB3aWxsIG5vdCByZXZlcnQgdGhlIG90aGVyIHN1Y2Nlc3NmdWwgcmVxdWVzdHNcbiAgICAgICAgICAvLyBpdCBvbmx5IHJhaXNlcyBlcnJvciB3aGVuIG1ldCBhdCBsZWFzdCBvbmUgZmFpbGVkIHJlcXVlc3QuXG4gICAgICAgICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lIHx8ICFlcnIuZXJyb3JDb2RlKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0b1NhdmVSZXN1bHQoZXJyKTtcbiAgICAgICAgfSksXG4gICAgICApLFxuICAgICk7XG4gIH1cblxuICAvKiogQHByaXZhdGUgKi9cbiAgYXN5bmMgX3VwZGF0ZU1hbnkoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZHM6IFJlY29yZFtdLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPiB7XG4gICAgaWYgKHJlY29yZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIGlmIChyZWNvcmRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX3VwZGF0ZU1hbnkoXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICByZWNvcmRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fdXBkYXRlTWFueShcbiAgICAgICAgICB0eXBlLFxuICAgICAgICAgIHJlY29yZHMuc2xpY2UoTUFYX0RNTF9DT1VOVCksXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBjb25zdCBfcmVjb3JkcyA9IHJlY29yZHMubWFwKChyZWNvcmQpID0+IHtcbiAgICAgIGNvbnN0IHsgSWQ6IGlkLCB0eXBlOiBydHlwZSwgYXR0cmlidXRlcywgLi4ucmVjIH0gPSByZWNvcmQ7XG4gICAgICBpZiAoIWlkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmVjb3JkIGlkIGlzIG5vdCBmb3VuZCBpbiByZWNvcmQuJyk7XG4gICAgICB9XG4gICAgICBjb25zdCBzb2JqZWN0VHlwZSA9IHR5cGUgfHwgKGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy50eXBlKSB8fCBydHlwZTtcbiAgICAgIGlmICghc29iamVjdFR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBTT2JqZWN0IFR5cGUgZGVmaW5lZCBpbiByZWNvcmQnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGlkLCBhdHRyaWJ1dGVzOiB7IHR5cGU6IHNvYmplY3RUeXBlIH0sIC4uLnJlYyB9O1xuICAgIH0pO1xuICAgIGNvbnN0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdjb21wb3NpdGUnLCAnc29iamVjdHMnXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh7XG4gICAgICBtZXRob2Q6ICdQQVRDSCcsXG4gICAgICB1cmwsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGFsbE9yTm9uZTogb3B0aW9ucy5hbGxPck5vbmUgfHwgZmFsc2UsXG4gICAgICAgIHJlY29yZHM6IF9yZWNvcmRzLFxuICAgICAgfSksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcHNlcnQgcmVjb3Jkc1xuICAgKi9cbiAgdXBzZXJ0PFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gICAgRmllbGROYW1lcyBleHRlbmRzIFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+ID0gU09iamVjdEZpZWxkTmFtZXM8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IElucHV0UmVjb3JkW10sXG4gICAgZXh0SWRGaWVsZDogRmllbGROYW1lcyxcbiAgICBvcHRpb25zPzogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydDxcbiAgICBOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+LFxuICAgIElucHV0UmVjb3JkIGV4dGVuZHMgU09iamVjdElucHV0UmVjb3JkPFMsIE4+ID0gU09iamVjdElucHV0UmVjb3JkPFMsIE4+LFxuICAgIEZpZWxkTmFtZXMgZXh0ZW5kcyBTT2JqZWN0RmllbGROYW1lczxTLCBOPiA9IFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+XG4gID4oXG4gICAgdHlwZTogTixcbiAgICByZWNvcmQ6IElucHV0UmVjb3JkLFxuICAgIGV4dElkRmllbGQ6IEZpZWxkTmFtZXMsXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8VXBzZXJ0UmVzdWx0PjtcbiAgdXBzZXJ0PFxuICAgIE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4sXG4gICAgSW5wdXRSZWNvcmQgZXh0ZW5kcyBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4gPSBTT2JqZWN0SW5wdXRSZWNvcmQ8UywgTj4sXG4gICAgRmllbGROYW1lcyBleHRlbmRzIFNPYmplY3RGaWVsZE5hbWVzPFMsIE4+ID0gU09iamVjdEZpZWxkTmFtZXM8UywgTj5cbiAgPihcbiAgICB0eXBlOiBOLFxuICAgIHJlY29yZHM6IElucHV0UmVjb3JkIHwgSW5wdXRSZWNvcmRbXSxcbiAgICBleHRJZEZpZWxkOiBGaWVsZE5hbWVzLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFVwc2VydFJlc3VsdCB8IFVwc2VydFJlc3VsdFtdPjtcbiAgLyoqXG4gICAqXG4gICAqIEBwYXJhbSB0eXBlXG4gICAqIEBwYXJhbSByZWNvcmRzXG4gICAqIEBwYXJhbSBleHRJZEZpZWxkXG4gICAqIEBwYXJhbSBvcHRpb25zXG4gICAqL1xuICBhc3luYyB1cHNlcnQoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHJlY29yZHM6IFJlY29yZCB8IFJlY29yZFtdLFxuICAgIGV4dElkRmllbGQ6IHN0cmluZyxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT4ge1xuICAgIGNvbnN0IGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KHJlY29yZHMpO1xuICAgIGNvbnN0IF9yZWNvcmRzID0gQXJyYXkuaXNBcnJheShyZWNvcmRzKSA/IHJlY29yZHMgOiBbcmVjb3Jkc107XG4gICAgaWYgKF9yZWNvcmRzLmxlbmd0aCA+IHRoaXMuX21heFJlcXVlc3QpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRXhjZWVkZWQgbWF4IGxpbWl0IG9mIGNvbmN1cnJlbnQgY2FsbCcpO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBfcmVjb3Jkcy5tYXAoKHJlY29yZCkgPT4ge1xuICAgICAgICBjb25zdCB7IFtleHRJZEZpZWxkXTogZXh0SWQsIHR5cGU6IHJ0eXBlLCBhdHRyaWJ1dGVzLCAuLi5yZWMgfSA9IHJlY29yZDtcbiAgICAgICAgY29uc3QgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgdHlwZSwgZXh0SWRGaWVsZCwgZXh0SWRdLmpvaW4oXG4gICAgICAgICAgJy8nLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFNhdmVSZXN1bHQ+KFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ1BBVENIJyxcbiAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlYyksXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuICAgICAgICAgICAgICAnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5vQ29udGVudFJlc3BvbnNlOiB7IHN1Y2Nlc3M6IHRydWUsIGVycm9yczogW10gfSxcbiAgICAgICAgICB9LFxuICAgICAgICApLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAvLyBCZSBhd2FyZSB0aGF0IGBhbGxPck5vbmVgIG9wdGlvbiBpbiB1cHNlcnQgbWV0aG9kXG4gICAgICAgICAgLy8gd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzLlxuICAgICAgICAgIC8vIEl0IG9ubHkgcmFpc2VzIGVycm9yIHdoZW4gbWV0IGF0IGxlYXN0IG9uZSBmYWlsZWQgcmVxdWVzdC5cbiAgICAgICAgICBpZiAoIWlzQXJyYXkgfHwgb3B0aW9ucy5hbGxPck5vbmUgfHwgIWVyci5lcnJvckNvZGUpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRvU2F2ZVJlc3VsdChlcnIpO1xuICAgICAgICB9KTtcbiAgICAgIH0pLFxuICAgICk7XG4gICAgcmV0dXJuIGlzQXJyYXkgPyByZXN1bHRzIDogcmVzdWx0c1swXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWxldGUgcmVjb3Jkc1xuICAgKi9cbiAgZGVzdHJveTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIGlkczogc3RyaW5nW10sXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgZGVzdHJveTxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+PihcbiAgICB0eXBlOiBOLFxuICAgIGlkOiBzdHJpbmcsXG4gICAgb3B0aW9ucz86IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD47XG4gIGRlc3Ryb3k8TiBleHRlbmRzIFNPYmplY3ROYW1lczxTPj4oXG4gICAgdHlwZTogTixcbiAgICBpZHM6IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIG9wdGlvbnM/OiBEbWxPcHRpb25zLFxuICApOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICAvKipcbiAgICogQHBhcmFtIHR5cGVcbiAgICogQHBhcmFtIGlkc1xuICAgKiBAcGFyYW0gb3B0aW9uc1xuICAgKi9cbiAgYXN5bmMgZGVzdHJveShcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBvcHRpb25zOiBEbWxPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT4ge1xuICAgIHJldHVybiBBcnJheS5pc0FycmF5KGlkcylcbiAgICAgID8gLy8gY2hlY2sgdGhlIHZlcnNpb24gd2hldGhlciBTT2JqZWN0IGNvbGxlY3Rpb24gQVBJIGlzIHN1cHBvcnRlZCAoNDIuMClcbiAgICAgICAgdGhpcy5fZW5zdXJlVmVyc2lvbig0MilcbiAgICAgICAgPyB0aGlzLl9kZXN0cm95TWFueSh0eXBlLCBpZHMsIG9wdGlvbnMpXG4gICAgICAgIDogdGhpcy5fZGVzdHJveVBhcmFsbGVsKHR5cGUsIGlkcywgb3B0aW9ucylcbiAgICAgIDogdGhpcy5fZGVzdHJveVNpbmdsZSh0eXBlLCBpZHMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9kZXN0cm95U2luZ2xlKFxuICAgIHR5cGU6IHN0cmluZyxcbiAgICBpZDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERtbE9wdGlvbnMsXG4gICk6IFByb21pc2U8U2F2ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHVybCA9IFt0aGlzLl9iYXNlVXJsKCksICdzb2JqZWN0cycsIHR5cGUsIGlkXS5qb2luKCcvJyk7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgdXJsLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMgfHwge30sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBub0NvbnRlbnRSZXNwb25zZTogeyBpZCwgc3VjY2VzczogdHJ1ZSwgZXJyb3JzOiBbXSB9LFxuICAgICAgfSxcbiAgICApO1xuICB9XG5cbiAgLyoqIEBwcml2YXRlICovXG4gIGFzeW5jIF9kZXN0cm95UGFyYWxsZWwodHlwZTogc3RyaW5nLCBpZHM6IHN0cmluZ1tdLCBvcHRpb25zOiBEbWxPcHRpb25zKSB7XG4gICAgaWYgKGlkcy5sZW5ndGggPiB0aGlzLl9tYXhSZXF1ZXN0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4Y2VlZGVkIG1heCBsaW1pdCBvZiBjb25jdXJyZW50IGNhbGwnKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgaWRzLm1hcCgoaWQpID0+XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaW5nbGUodHlwZSwgaWQsIG9wdGlvbnMpLmNhdGNoKChlcnIpID0+IHtcbiAgICAgICAgICAvLyBCZSBhd2FyZSB0aGF0IGBhbGxPck5vbmVgIG9wdGlvbiBpbiBwYXJhbGxlbCBtb2RlXG4gICAgICAgICAgLy8gd2lsbCBub3QgcmV2ZXJ0IHRoZSBvdGhlciBzdWNjZXNzZnVsIHJlcXVlc3RzLlxuICAgICAgICAgIC8vIEl0IG9ubHkgcmFpc2VzIGVycm9yIHdoZW4gbWV0IGF0IGxlYXN0IG9uZSBmYWlsZWQgcmVxdWVzdC5cbiAgICAgICAgICBpZiAob3B0aW9ucy5hbGxPck5vbmUgfHwgIWVyci5lcnJvckNvZGUpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRvU2F2ZVJlc3VsdChlcnIpO1xuICAgICAgICB9KSxcbiAgICAgICksXG4gICAgKTtcbiAgfVxuXG4gIC8qKiBAcHJpdmF0ZSAqL1xuICBhc3luYyBfZGVzdHJveU1hbnkoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIGlkczogc3RyaW5nW10sXG4gICAgb3B0aW9uczogRG1sT3B0aW9ucyxcbiAgKTogUHJvbWlzZTxTYXZlUmVzdWx0W10+IHtcbiAgICBpZiAoaWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgICBpZiAoaWRzLmxlbmd0aCA+IE1BWF9ETUxfQ09VTlQgJiYgb3B0aW9ucy5hbGxvd1JlY3Vyc2l2ZSkge1xuICAgICAgcmV0dXJuIFtcbiAgICAgICAgLi4uKGF3YWl0IHRoaXMuX2Rlc3Ryb3lNYW55KFxuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgaWRzLnNsaWNlKDAsIE1BWF9ETUxfQ09VTlQpLFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICkpLFxuICAgICAgICAuLi4oYXdhaXQgdGhpcy5fZGVzdHJveU1hbnkodHlwZSwgaWRzLnNsaWNlKE1BWF9ETUxfQ09VTlQpLCBvcHRpb25zKSksXG4gICAgICBdO1xuICAgIH1cbiAgICBsZXQgdXJsID1cbiAgICAgIFt0aGlzLl9iYXNlVXJsKCksICdjb21wb3NpdGUnLCAnc29iamVjdHM/aWRzPSddLmpvaW4oJy8nKSArIGlkcy5qb2luKCcsJyk7XG4gICAgaWYgKG9wdGlvbnMuYWxsT3JOb25lKSB7XG4gICAgICB1cmwgKz0gJyZhbGxPck5vbmU9dHJ1ZSc7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgIHVybCxcbiAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyB8fCB7fSxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTeW5vbnltIG9mIENvbm5lY3Rpb24jZGVzdHJveSgpXG4gICAqL1xuICBkZWxldGUgPSB0aGlzLmRlc3Ryb3k7XG5cbiAgLyoqXG4gICAqIFN5bm9ueW0gb2YgQ29ubmVjdGlvbiNkZXN0cm95KClcbiAgICovXG4gIGRlbCA9IHRoaXMuZGVzdHJveTtcblxuICAvKipcbiAgICogRGVzY3JpYmUgU09iamVjdCBtZXRhZGF0YVxuICAgKi9cbiAgYXN5bmMgZGVzY3JpYmUodHlwZTogc3RyaW5nKTogUHJvbWlzZTxEZXNjcmliZVNPYmplY3RSZXN1bHQ+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlLCAnZGVzY3JpYmUnXS5qb2luKCcvJyk7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlU09iamVjdFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXNjcmliZSBnbG9iYWwgU09iamVjdHNcbiAgICovXG4gIGFzeW5jIGRlc2NyaWJlR2xvYmFsKCkge1xuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuX2Jhc2VVcmwoKX0vc29iamVjdHNgO1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsKTtcbiAgICByZXR1cm4gYm9keSBhcyBEZXNjcmliZUdsb2JhbFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgU09iamVjdCBpbnN0YW5jZVxuICAgKi9cbiAgc29iamVjdDxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+Pih0eXBlOiBOKTogU09iamVjdDxTLCBOPjtcbiAgc29iamVjdDxOIGV4dGVuZHMgU09iamVjdE5hbWVzPFM+Pih0eXBlOiBzdHJpbmcpOiBTT2JqZWN0PFMsIE4+O1xuICBzb2JqZWN0PE4gZXh0ZW5kcyBTT2JqZWN0TmFtZXM8Uz4+KHR5cGU6IE4gfCBzdHJpbmcpOiBTT2JqZWN0PFMsIE4+IHtcbiAgICBjb25zdCBzbyA9XG4gICAgICAodGhpcy5zb2JqZWN0c1t0eXBlIGFzIE5dIGFzIFNPYmplY3Q8UywgTj4gfCB1bmRlZmluZWQpIHx8XG4gICAgICBuZXcgU09iamVjdCh0aGlzLCB0eXBlIGFzIE4pO1xuICAgIHRoaXMuc29iamVjdHNbdHlwZSBhcyBOXSA9IHNvO1xuICAgIHJldHVybiBzbztcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgaWRlbnRpdHkgaW5mb3JtYXRpb24gb2YgY3VycmVudCB1c2VyXG4gICAqL1xuICBhc3luYyBpZGVudGl0eShvcHRpb25zOiB7IGhlYWRlcnM/OiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSB9ID0ge30pIHtcbiAgICBsZXQgdXJsID0gdGhpcy51c2VySW5mbyAmJiB0aGlzLnVzZXJJbmZvLnVybDtcbiAgICBpZiAoIXVybCkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5yZXF1ZXN0PHsgaWRlbnRpdHk6IHN0cmluZyB9Pih7XG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIHVybDogdGhpcy5fYmFzZVVybCgpLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICB9KTtcbiAgICAgIHVybCA9IHJlcy5pZGVudGl0eTtcbiAgICB9XG4gICAgdXJsICs9ICc/Zm9ybWF0PWpzb24nO1xuICAgIGlmICh0aGlzLmFjY2Vzc1Rva2VuKSB7XG4gICAgICB1cmwgKz0gYCZvYXV0aF90b2tlbj0ke2VuY29kZVVSSUNvbXBvbmVudCh0aGlzLmFjY2Vzc1Rva2VuKX1gO1xuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8SWRlbnRpdHlJbmZvPih7IG1ldGhvZDogJ0dFVCcsIHVybCB9KTtcbiAgICB0aGlzLnVzZXJJbmZvID0ge1xuICAgICAgaWQ6IHJlcy51c2VyX2lkLFxuICAgICAgb3JnYW5pemF0aW9uSWQ6IHJlcy5vcmdhbml6YXRpb25faWQsXG4gICAgICB1cmw6IHJlcy5pZCxcbiAgICB9O1xuICAgIHJldHVybiByZXM7XG4gIH1cblxuICAvKipcbiAgICogTGlzdCByZWNlbnRseSB2aWV3ZWQgcmVjb3Jkc1xuICAgKi9cbiAgYXN5bmMgcmVjZW50KHR5cGU/OiBzdHJpbmcgfCBudW1iZXIsIGxpbWl0PzogbnVtYmVyKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tcGFyYW0tcmVhc3NpZ24gKi9cbiAgICBpZiAodHlwZW9mIHR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgICBsaW1pdCA9IHR5cGU7XG4gICAgICB0eXBlID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBsZXQgdXJsO1xuICAgIGlmICh0eXBlKSB7XG4gICAgICB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlXS5qb2luKCcvJyk7XG4gICAgICBjb25zdCB7IHJlY2VudEl0ZW1zIH0gPSBhd2FpdCB0aGlzLnJlcXVlc3Q8eyByZWNlbnRJdGVtczogUmVjb3JkW10gfT4oXG4gICAgICAgIHVybCxcbiAgICAgICk7XG4gICAgICByZXR1cm4gbGltaXQgPyByZWNlbnRJdGVtcy5zbGljZSgwLCBsaW1pdCkgOiByZWNlbnRJdGVtcztcbiAgICB9XG4gICAgdXJsID0gYCR7dGhpcy5fYmFzZVVybCgpfS9yZWNlbnRgO1xuICAgIGlmIChsaW1pdCkge1xuICAgICAgdXJsICs9IGA/bGltaXQ9JHtsaW1pdH1gO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFJlY29yZFtdPih1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlIHVwZGF0ZWQgcmVjb3Jkc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlZChcbiAgICB0eXBlOiBzdHJpbmcsXG4gICAgc3RhcnQ6IHN0cmluZyB8IERhdGUsXG4gICAgZW5kOiBzdHJpbmcgfCBEYXRlLFxuICApOiBQcm9taXNlPFVwZGF0ZWRSZXN1bHQ+IHtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1wYXJhbS1yZWFzc2lnbiAqL1xuICAgIGxldCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnc29iamVjdHMnLCB0eXBlLCAndXBkYXRlZCddLmpvaW4oJy8nKTtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgc3RhcnQgPSBuZXcgRGF0ZShzdGFydCk7XG4gICAgfVxuICAgIHN0YXJ0ID0gZm9ybWF0RGF0ZShzdGFydCk7XG4gICAgdXJsICs9IGA/c3RhcnQ9JHtlbmNvZGVVUklDb21wb25lbnQoc3RhcnQpfWA7XG4gICAgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmQgPSBuZXcgRGF0ZShlbmQpO1xuICAgIH1cbiAgICBlbmQgPSBmb3JtYXREYXRlKGVuZCk7XG4gICAgdXJsICs9IGAmZW5kPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGVuZCl9YDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgVXBkYXRlZFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZSBkZWxldGVkIHJlY29yZHNcbiAgICovXG4gIGFzeW5jIGRlbGV0ZWQoXG4gICAgdHlwZTogc3RyaW5nLFxuICAgIHN0YXJ0OiBzdHJpbmcgfCBEYXRlLFxuICAgIGVuZDogc3RyaW5nIHwgRGF0ZSxcbiAgKTogUHJvbWlzZTxEZWxldGVkUmVzdWx0PiB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tcGFyYW0tcmVhc3NpZ24gKi9cbiAgICBsZXQgdXJsID0gW3RoaXMuX2Jhc2VVcmwoKSwgJ3NvYmplY3RzJywgdHlwZSwgJ2RlbGV0ZWQnXS5qb2luKCcvJyk7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHN0YXJ0ID0gbmV3IERhdGUoc3RhcnQpO1xuICAgIH1cbiAgICBzdGFydCA9IGZvcm1hdERhdGUoc3RhcnQpO1xuICAgIHVybCArPSBgP3N0YXJ0PSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN0YXJ0KX1gO1xuXG4gICAgaWYgKHR5cGVvZiBlbmQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmQgPSBuZXcgRGF0ZShlbmQpO1xuICAgIH1cbiAgICBlbmQgPSBmb3JtYXREYXRlKGVuZCk7XG4gICAgdXJsICs9IGAmZW5kPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGVuZCl9YDtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVsZXRlZFJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgbGlzdCBvZiBhbGwgdGFic1xuICAgKi9cbiAgYXN5bmMgdGFicygpOiBQcm9taXNlPERlc2NyaWJlVGFiW10+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAndGFicyddLmpvaW4oJy8nKTtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCk7XG4gICAgcmV0dXJuIGJvZHkgYXMgRGVzY3JpYmVUYWJbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGN1cnJlbnQgc3lzdGVtIGxpbWl0IGluIHRoZSBvcmdhbml6YXRpb25cbiAgICovXG4gIGFzeW5jIGxpbWl0cygpOiBQcm9taXNlPE9yZ2FuaXphdGlvbkxpbWl0c0luZm8+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAnbGltaXRzJ10uam9pbignLycpO1xuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsKTtcbiAgICByZXR1cm4gYm9keSBhcyBPcmdhbml6YXRpb25MaW1pdHNJbmZvO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSB0aGVtZSBpbmZvXG4gICAqL1xuICBhc3luYyB0aGVtZSgpOiBQcm9taXNlPERlc2NyaWJlVGhlbWU+IHtcbiAgICBjb25zdCB1cmwgPSBbdGhpcy5fYmFzZVVybCgpLCAndGhlbWUnXS5qb2luKCcvJyk7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlVGhlbWU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbGwgcmVnaXN0ZXJlZCBnbG9iYWwgcXVpY2sgYWN0aW9uc1xuICAgKi9cbiAgYXN5bmMgcXVpY2tBY3Rpb25zKCk6IFByb21pc2U8RGVzY3JpYmVRdWlja0FjdGlvblJlc3VsdFtdPiB7XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVxdWVzdCgnL3F1aWNrQWN0aW9ucycpO1xuICAgIHJldHVybiBib2R5IGFzIERlc2NyaWJlUXVpY2tBY3Rpb25SZXN1bHRbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcmVmZXJlbmNlIGZvciBzcGVjaWZpZWQgZ2xvYmFsIHF1aWNrIGFjdGlvblxuICAgKi9cbiAgcXVpY2tBY3Rpb24oYWN0aW9uTmFtZTogc3RyaW5nKTogUXVpY2tBY3Rpb248Uz4ge1xuICAgIHJldHVybiBuZXcgUXVpY2tBY3Rpb24odGhpcywgYC9xdWlja0FjdGlvbnMvJHthY3Rpb25OYW1lfWApO1xuICB9XG5cbiAgLyoqXG4gICAqIE1vZHVsZSB3aGljaCBtYW5hZ2VzIHByb2Nlc3MgcnVsZXMgYW5kIGFwcHJvdmFsIHByb2Nlc3Nlc1xuICAgKi9cbiAgcHJvY2VzcyA9IG5ldyBQcm9jZXNzKHRoaXMpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBDb25uZWN0aW9uO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FB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