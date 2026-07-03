"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs3/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.promise");
require("core-js/modules/es.string.replace");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.OAuth2 = void 0;
var _indexOf = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/index-of"));
var _slice = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/slice"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _crypto = require("crypto");
var _querystring = _interopRequireDefault(require("querystring"));
var _transport = _interopRequireWildcard(require("./transport"));
function ownKeys(object, enumerableOnly) { var keys = _Object$keys(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source), true)).call(_context3, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context4; _forEachInstanceProperty(_context4 = ownKeys(Object(source))).call(_context4, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
const defaultOAuth2Config = {
  loginUrl: 'https://login.salesforce.com'
};

// Makes a nodejs base64 encoded string compatible with rfc4648 alternative encoding for urls.
// @param base64Encoded a nodejs base64 encoded string
function base64UrlEscape(base64Encoded) {
  // builtin node js base 64 encoding is not 64 url compatible.
  // See https://toolsn.ietf.org/html/rfc4648#section-5
  return base64Encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * type defs
 */

/**
 * OAuth2 class
 */
class OAuth2 {
  /**
   *
   */
  constructor(config) {
    (0, _defineProperty2.default)(this, "loginUrl", void 0);
    (0, _defineProperty2.default)(this, "authzServiceUrl", void 0);
    (0, _defineProperty2.default)(this, "tokenServiceUrl", void 0);
    (0, _defineProperty2.default)(this, "revokeServiceUrl", void 0);
    (0, _defineProperty2.default)(this, "clientId", void 0);
    (0, _defineProperty2.default)(this, "clientSecret", void 0);
    (0, _defineProperty2.default)(this, "redirectUri", void 0);
    (0, _defineProperty2.default)(this, "codeVerifier", void 0);
    (0, _defineProperty2.default)(this, "_transport", void 0);
    const {
      loginUrl,
      authzServiceUrl,
      tokenServiceUrl,
      revokeServiceUrl,
      clientId,
      clientSecret,
      redirectUri,
      proxyUrl,
      httpProxy,
      useVerifier
    } = config;
    if (authzServiceUrl && tokenServiceUrl) {
      var _context;
      this.loginUrl = (0, _slice.default)(_context = authzServiceUrl.split('/')).call(_context, 0, 3).join('/');
      this.authzServiceUrl = authzServiceUrl;
      this.tokenServiceUrl = tokenServiceUrl;
      this.revokeServiceUrl = revokeServiceUrl || `${this.loginUrl}/services/oauth2/revoke`;
    } else {
      this.loginUrl = loginUrl || defaultOAuth2Config.loginUrl;
      this.authzServiceUrl = `${this.loginUrl}/services/oauth2/authorize`;
      this.tokenServiceUrl = `${this.loginUrl}/services/oauth2/token`;
      this.revokeServiceUrl = `${this.loginUrl}/services/oauth2/revoke`;
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    if (proxyUrl) {
      this._transport = new _transport.XdProxyTransport(proxyUrl);
    } else if (httpProxy) {
      this._transport = new _transport.HttpProxyTransport(httpProxy);
    } else {
      this._transport = new _transport.default();
    }
    if (useVerifier) {
      // Set a code verifier string for OAuth authorization
      this.codeVerifier = base64UrlEscape((0, _crypto.randomBytes)(Math.ceil(128)).toString('base64'));
    }
  }

  /**
   * Get Salesforce OAuth2 authorization page URL to redirect user agent.
   */
  getAuthorizationUrl(params = {}) {
    var _context2;
    if (this.codeVerifier) {
      // code verifier must be a base 64 url encoded hash of 128 bytes of random data. Our random data is also
      // base 64 url encoded. See Connection.create();
      const codeChallenge = base64UrlEscape((0, _crypto.createHash)('sha256').update(this.codeVerifier).digest('base64'));
      params.code_challenge = codeChallenge;
    }
    const _params = _objectSpread(_objectSpread({}, params), {}, {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri
    });
    return this.authzServiceUrl + ((0, _indexOf.default)(_context2 = this.authzServiceUrl).call(_context2, '?') >= 0 ? '&' : '?') + _querystring.default.stringify(_params);
  }

  /**
   * OAuth2 Refresh Token Flow
   */
  async refreshToken(refreshToken) {
    if (!this.clientId) {
      throw new Error('No OAuth2 client id information is specified');
    }
    const params = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.clientId
    };
    if (this.clientSecret) {
      params.client_secret = this.clientSecret;
    }
    const ret = await this._postParams(params);
    return ret;
  }

  /**
   * Send access token request to the token endpoint.
   * When a code (string) is passed in first argument, it will use Web Server Authentication Flow (Authorization Code Grant).
   * Otherwise, it will use the specified `grant_type` and pass parameters to the endpoint.
   */
  async requestToken(codeOrParams, params = {}) {
    if (typeof codeOrParams === 'string' && (!this.clientId || !this.redirectUri)) {
      throw new Error('No OAuth2 client id or redirect uri configuration is specified');
    }
    const _params = _objectSpread(_objectSpread({}, params), typeof codeOrParams === 'string' ? {
      grant_type: 'authorization_code',
      code: codeOrParams
    } : codeOrParams);
    if (this.clientId) {
      _params.client_id = this.clientId;
    }
    if (this.clientSecret) {
      _params.client_secret = this.clientSecret;
    }
    if (this.redirectUri) {
      _params.redirect_uri = this.redirectUri;
    }
    const ret = await this._postParams(_params);
    return ret;
  }

  /**
   * OAuth2 Username-Password Flow (Resource Owner Password Credentials)
   */
  async authenticate(username, password) {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('No valid OAuth2 client configuration set');
    }
    const ret = await this._postParams({
      grant_type: 'password',
      username,
      password,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri
    });
    return ret;
  }

  /**
   * OAuth2 Revoke Session Token
   */
  async revokeToken(token) {
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: this.revokeServiceUrl,
      body: _querystring.default.stringify({
        token
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    });
    if (response.statusCode >= 400) {
      let res = _querystring.default.parse(response.body);
      if (!res || !res.error) {
        res = {
          error: `ERROR_HTTP_${response.statusCode}`,
          error_description: response.body
        };
      }
      throw new class extends Error {
        constructor({
          error,
          error_description
        }) {
          super(error_description);
          this.name = error;
        }
      }(res);
    }
  }

  /**
   * @private
   */
  async _postParams(params) {
    if (this.codeVerifier) params.code_verifier = this.codeVerifier;
    const response = await this._transport.httpRequest({
      method: 'POST',
      url: this.tokenServiceUrl,
      body: _querystring.default.stringify(params),
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    });
    let res;
    try {
      res = JSON.parse(response.body);
    } catch (e) {
      /* eslint-disable no-empty */
    }
    if (response.statusCode >= 400) {
      res = res || {
        error: `ERROR_HTTP_${response.statusCode}`,
        error_description: response.body
      };
      throw new class extends Error {
        constructor({
          error,
          error_description
        }) {
          super(error_description);
          this.name = error;
        }
      }(res);
    }
    return res;
  }
}
exports.OAuth2 = OAuth2;
var _default = OAuth2;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfY3J5cHRvIiwicmVxdWlyZSIsIl9xdWVyeXN0cmluZyIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfdHJhbnNwb3J0IiwiX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQiLCJvd25LZXlzIiwib2JqZWN0IiwiZW51bWVyYWJsZU9ubHkiLCJrZXlzIiwiX09iamVjdCRrZXlzIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eVN5bWJvbHMiLCJzeW1ib2xzIiwiX2ZpbHRlckluc3RhbmNlUHJvcGVydHkiLCJjYWxsIiwic3ltIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJfY29udGV4dDMiLCJfZm9yRWFjaEluc3RhbmNlUHJvcGVydHkiLCJPYmplY3QiLCJrZXkiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsIl9PYmplY3QkZGVmaW5lUHJvcGVydGllcyIsIl9jb250ZXh0NCIsIl9PYmplY3QkZGVmaW5lUHJvcGVydHkiLCJkZWZhdWx0T0F1dGgyQ29uZmlnIiwibG9naW5VcmwiLCJiYXNlNjRVcmxFc2NhcGUiLCJiYXNlNjRFbmNvZGVkIiwicmVwbGFjZSIsIk9BdXRoMiIsImNvbnN0cnVjdG9yIiwiY29uZmlnIiwiYXV0aHpTZXJ2aWNlVXJsIiwidG9rZW5TZXJ2aWNlVXJsIiwicmV2b2tlU2VydmljZVVybCIsImNsaWVudElkIiwiY2xpZW50U2VjcmV0IiwicmVkaXJlY3RVcmkiLCJwcm94eVVybCIsImh0dHBQcm94eSIsInVzZVZlcmlmaWVyIiwiX2NvbnRleHQiLCJfc2xpY2UiLCJzcGxpdCIsImpvaW4iLCJYZFByb3h5VHJhbnNwb3J0IiwiSHR0cFByb3h5VHJhbnNwb3J0IiwiVHJhbnNwb3J0IiwiY29kZVZlcmlmaWVyIiwicmFuZG9tQnl0ZXMiLCJNYXRoIiwiY2VpbCIsInRvU3RyaW5nIiwiZ2V0QXV0aG9yaXphdGlvblVybCIsInBhcmFtcyIsIl9jb250ZXh0MiIsImNvZGVDaGFsbGVuZ2UiLCJjcmVhdGVIYXNoIiwidXBkYXRlIiwiZGlnZXN0IiwiY29kZV9jaGFsbGVuZ2UiLCJfcGFyYW1zIiwicmVzcG9uc2VfdHlwZSIsImNsaWVudF9pZCIsInJlZGlyZWN0X3VyaSIsIl9pbmRleE9mIiwicXVlcnlzdHJpbmciLCJzdHJpbmdpZnkiLCJyZWZyZXNoVG9rZW4iLCJFcnJvciIsImdyYW50X3R5cGUiLCJyZWZyZXNoX3Rva2VuIiwiY2xpZW50X3NlY3JldCIsInJldCIsIl9wb3N0UGFyYW1zIiwicmVxdWVzdFRva2VuIiwiY29kZU9yUGFyYW1zIiwiY29kZSIsImF1dGhlbnRpY2F0ZSIsInVzZXJuYW1lIiwicGFzc3dvcmQiLCJyZXZva2VUb2tlbiIsInRva2VuIiwicmVzcG9uc2UiLCJodHRwUmVxdWVzdCIsIm1ldGhvZCIsInVybCIsImJvZHkiLCJoZWFkZXJzIiwic3RhdHVzQ29kZSIsInJlcyIsInBhcnNlIiwiZXJyb3IiLCJlcnJvcl9kZXNjcmlwdGlvbiIsIm5hbWUiLCJjb2RlX3ZlcmlmaWVyIiwiSlNPTiIsImUiLCJleHBvcnRzIiwiX2RlZmF1bHQiXSwic291cmNlcyI6WyIuLi9zcmMvb2F1dGgyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICpcbiAqL1xuaW1wb3J0IHsgY3JlYXRlSGFzaCwgcmFuZG9tQnl0ZXMgfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IHF1ZXJ5c3RyaW5nIGZyb20gJ3F1ZXJ5c3RyaW5nJztcbmltcG9ydCBUcmFuc3BvcnQsIHsgWGRQcm94eVRyYW5zcG9ydCwgSHR0cFByb3h5VHJhbnNwb3J0IH0gZnJvbSAnLi90cmFuc3BvcnQnO1xuaW1wb3J0IHsgT3B0aW9uYWwgfSBmcm9tICcuL3R5cGVzJztcblxuY29uc3QgZGVmYXVsdE9BdXRoMkNvbmZpZyA9IHtcbiAgbG9naW5Vcmw6ICdodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tJyxcbn07XG5cbi8vIE1ha2VzIGEgbm9kZWpzIGJhc2U2NCBlbmNvZGVkIHN0cmluZyBjb21wYXRpYmxlIHdpdGggcmZjNDY0OCBhbHRlcm5hdGl2ZSBlbmNvZGluZyBmb3IgdXJscy5cbi8vIEBwYXJhbSBiYXNlNjRFbmNvZGVkIGEgbm9kZWpzIGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuZnVuY3Rpb24gYmFzZTY0VXJsRXNjYXBlKGJhc2U2NEVuY29kZWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIGJ1aWx0aW4gbm9kZSBqcyBiYXNlIDY0IGVuY29kaW5nIGlzIG5vdCA2NCB1cmwgY29tcGF0aWJsZS5cbiAgLy8gU2VlIGh0dHBzOi8vdG9vbHNuLmlldGYub3JnL2h0bWwvcmZjNDY0OCNzZWN0aW9uLTVcbiAgcmV0dXJuIGJhc2U2NEVuY29kZWRcbiAgICAucmVwbGFjZSgvXFwrL2csICctJylcbiAgICAucmVwbGFjZSgvXFwvL2csICdfJylcbiAgICAucmVwbGFjZSgvPS9nLCAnJyk7XG59XG5cbi8qKlxuICogdHlwZSBkZWZzXG4gKi9cbmV4cG9ydCB0eXBlIE9BdXRoMkNvbmZpZyA9IHtcbiAgY2xpZW50SWQ/OiBzdHJpbmc7XG4gIGNsaWVudFNlY3JldD86IHN0cmluZztcbiAgcmVkaXJlY3RVcmk/OiBzdHJpbmc7XG4gIGxvZ2luVXJsPzogc3RyaW5nO1xuICBhdXRoelNlcnZpY2VVcmw/OiBzdHJpbmc7XG4gIHRva2VuU2VydmljZVVybD86IHN0cmluZztcbiAgcmV2b2tlU2VydmljZVVybD86IHN0cmluZztcbiAgcHJveHlVcmw/OiBzdHJpbmc7XG4gIGh0dHBQcm94eT86IHN0cmluZztcbiAgdXNlVmVyaWZpZXI/OiBib29sZWFuO1xufTtcblxuZXhwb3J0IHR5cGUgQXV0aHpSZXF1ZXN0UGFyYW1zID0ge1xuICBzY29wZT86IHN0cmluZztcbiAgc3RhdGU/OiBzdHJpbmc7XG4gIGNvZGVfY2hhbGxlbmdlPzogc3RyaW5nO1xufSAmIHtcbiAgW2F0dHI6IHN0cmluZ106IHN0cmluZztcbn07XG5cbmV4cG9ydCB0eXBlIFRva2VuUmVzcG9uc2UgPSB7XG4gIHRva2VuX3R5cGU6ICdCZWFyZXInO1xuICAvKipcbiAgICogSWRlbnRpdHkgVVJMXG4gICAqXG4gICAqIFRoZSBmb3JtYXQgb2YgdGhlIFVSTCBpcyBodHRwczovL2xvZ2luLnNhbGVzZm9yY2UuY29tL2lkL29yZ0lEL3VzZXJJRC5cbiAgICovXG4gIGlkOiBzdHJpbmc7XG4gIGFjY2Vzc190b2tlbjogc3RyaW5nO1xuICByZWZyZXNoX3Rva2VuPzogc3RyaW5nO1xuICBzaWduYXR1cmU6IHN0cmluZztcbiAgaXNzdWVkX2F0OiBzdHJpbmc7XG4gIGluc3RhbmNlX3VybDogc3RyaW5nO1xuICBzZmRjX2NvbW11bml0eV91cmw/OiBzdHJpbmc7XG4gIHNmZGNfY29tbXVuaXR5X2lkPzogc3RyaW5nO1xufTtcblxuLyoqXG4gKiBPQXV0aDIgY2xhc3NcbiAqL1xuZXhwb3J0IGNsYXNzIE9BdXRoMiB7XG4gIGxvZ2luVXJsOiBzdHJpbmc7XG4gIGF1dGh6U2VydmljZVVybDogc3RyaW5nO1xuICB0b2tlblNlcnZpY2VVcmw6IHN0cmluZztcbiAgcmV2b2tlU2VydmljZVVybDogc3RyaW5nO1xuICBjbGllbnRJZDogT3B0aW9uYWw8c3RyaW5nPjtcbiAgY2xpZW50U2VjcmV0OiBPcHRpb25hbDxzdHJpbmc+O1xuICByZWRpcmVjdFVyaTogT3B0aW9uYWw8c3RyaW5nPjtcbiAgY29kZVZlcmlmaWVyOiBPcHRpb25hbDxzdHJpbmc+O1xuXG4gIF90cmFuc3BvcnQ6IFRyYW5zcG9ydDtcblxuICAvKipcbiAgICpcbiAgICovXG4gIGNvbnN0cnVjdG9yKGNvbmZpZzogT0F1dGgyQ29uZmlnKSB7XG4gICAgY29uc3Qge1xuICAgICAgbG9naW5VcmwsXG4gICAgICBhdXRoelNlcnZpY2VVcmwsXG4gICAgICB0b2tlblNlcnZpY2VVcmwsXG4gICAgICByZXZva2VTZXJ2aWNlVXJsLFxuICAgICAgY2xpZW50SWQsXG4gICAgICBjbGllbnRTZWNyZXQsXG4gICAgICByZWRpcmVjdFVyaSxcbiAgICAgIHByb3h5VXJsLFxuICAgICAgaHR0cFByb3h5LFxuICAgICAgdXNlVmVyaWZpZXIsXG4gICAgfSA9IGNvbmZpZztcbiAgICBpZiAoYXV0aHpTZXJ2aWNlVXJsICYmIHRva2VuU2VydmljZVVybCkge1xuICAgICAgdGhpcy5sb2dpblVybCA9IGF1dGh6U2VydmljZVVybC5zcGxpdCgnLycpLnNsaWNlKDAsIDMpLmpvaW4oJy8nKTtcbiAgICAgIHRoaXMuYXV0aHpTZXJ2aWNlVXJsID0gYXV0aHpTZXJ2aWNlVXJsO1xuICAgICAgdGhpcy50b2tlblNlcnZpY2VVcmwgPSB0b2tlblNlcnZpY2VVcmw7XG4gICAgICB0aGlzLnJldm9rZVNlcnZpY2VVcmwgPVxuICAgICAgICByZXZva2VTZXJ2aWNlVXJsIHx8IGAke3RoaXMubG9naW5Vcmx9L3NlcnZpY2VzL29hdXRoMi9yZXZva2VgO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxvZ2luVXJsID0gbG9naW5VcmwgfHwgZGVmYXVsdE9BdXRoMkNvbmZpZy5sb2dpblVybDtcbiAgICAgIHRoaXMuYXV0aHpTZXJ2aWNlVXJsID0gYCR7dGhpcy5sb2dpblVybH0vc2VydmljZXMvb2F1dGgyL2F1dGhvcml6ZWA7XG4gICAgICB0aGlzLnRva2VuU2VydmljZVVybCA9IGAke3RoaXMubG9naW5Vcmx9L3NlcnZpY2VzL29hdXRoMi90b2tlbmA7XG4gICAgICB0aGlzLnJldm9rZVNlcnZpY2VVcmwgPSBgJHt0aGlzLmxvZ2luVXJsfS9zZXJ2aWNlcy9vYXV0aDIvcmV2b2tlYDtcbiAgICB9XG4gICAgdGhpcy5jbGllbnRJZCA9IGNsaWVudElkO1xuICAgIHRoaXMuY2xpZW50U2VjcmV0ID0gY2xpZW50U2VjcmV0O1xuICAgIHRoaXMucmVkaXJlY3RVcmkgPSByZWRpcmVjdFVyaTtcbiAgICBpZiAocHJveHlVcmwpIHtcbiAgICAgIHRoaXMuX3RyYW5zcG9ydCA9IG5ldyBYZFByb3h5VHJhbnNwb3J0KHByb3h5VXJsKTtcbiAgICB9IGVsc2UgaWYgKGh0dHBQcm94eSkge1xuICAgICAgdGhpcy5fdHJhbnNwb3J0ID0gbmV3IEh0dHBQcm94eVRyYW5zcG9ydChodHRwUHJveHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl90cmFuc3BvcnQgPSBuZXcgVHJhbnNwb3J0KCk7XG4gICAgfVxuICAgIGlmICh1c2VWZXJpZmllcikge1xuICAgICAgLy8gU2V0IGEgY29kZSB2ZXJpZmllciBzdHJpbmcgZm9yIE9BdXRoIGF1dGhvcml6YXRpb25cbiAgICAgIHRoaXMuY29kZVZlcmlmaWVyID0gYmFzZTY0VXJsRXNjYXBlKFxuICAgICAgICByYW5kb21CeXRlcyhNYXRoLmNlaWwoMTI4KSkudG9TdHJpbmcoJ2Jhc2U2NCcpLFxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IFNhbGVzZm9yY2UgT0F1dGgyIGF1dGhvcml6YXRpb24gcGFnZSBVUkwgdG8gcmVkaXJlY3QgdXNlciBhZ2VudC5cbiAgICovXG4gIGdldEF1dGhvcml6YXRpb25VcmwocGFyYW1zOiBBdXRoelJlcXVlc3RQYXJhbXMgPSB7fSkge1xuICAgIGlmICh0aGlzLmNvZGVWZXJpZmllcikge1xuICAgICAgLy8gY29kZSB2ZXJpZmllciBtdXN0IGJlIGEgYmFzZSA2NCB1cmwgZW5jb2RlZCBoYXNoIG9mIDEyOCBieXRlcyBvZiByYW5kb20gZGF0YS4gT3VyIHJhbmRvbSBkYXRhIGlzIGFsc29cbiAgICAgIC8vIGJhc2UgNjQgdXJsIGVuY29kZWQuIFNlZSBDb25uZWN0aW9uLmNyZWF0ZSgpO1xuICAgICAgY29uc3QgY29kZUNoYWxsZW5nZSA9IGJhc2U2NFVybEVzY2FwZShcbiAgICAgICAgY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKHRoaXMuY29kZVZlcmlmaWVyKS5kaWdlc3QoJ2Jhc2U2NCcpLFxuICAgICAgKTtcbiAgICAgIHBhcmFtcy5jb2RlX2NoYWxsZW5nZSA9IGNvZGVDaGFsbGVuZ2U7XG4gICAgfVxuXG4gICAgY29uc3QgX3BhcmFtcyA9IHtcbiAgICAgIC4uLnBhcmFtcyxcbiAgICAgIHJlc3BvbnNlX3R5cGU6ICdjb2RlJyxcbiAgICAgIGNsaWVudF9pZDogdGhpcy5jbGllbnRJZCxcbiAgICAgIHJlZGlyZWN0X3VyaTogdGhpcy5yZWRpcmVjdFVyaSxcbiAgICB9O1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLmF1dGh6U2VydmljZVVybCArXG4gICAgICAodGhpcy5hdXRoelNlcnZpY2VVcmwuaW5kZXhPZignPycpID49IDAgPyAnJicgOiAnPycpICtcbiAgICAgIHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShfcGFyYW1zIGFzIHsgW25hbWU6IHN0cmluZ106IGFueSB9KVxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogT0F1dGgyIFJlZnJlc2ggVG9rZW4gRmxvd1xuICAgKi9cbiAgYXN5bmMgcmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbjogc3RyaW5nKTogUHJvbWlzZTxUb2tlblJlc3BvbnNlPiB7XG4gICAgaWYgKCF0aGlzLmNsaWVudElkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIE9BdXRoMiBjbGllbnQgaWQgaW5mb3JtYXRpb24gaXMgc3BlY2lmaWVkJyk7XG4gICAgfVxuICAgIGNvbnN0IHBhcmFtczogeyBbcHJvcDogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICBncmFudF90eXBlOiAncmVmcmVzaF90b2tlbicsXG4gICAgICByZWZyZXNoX3Rva2VuOiByZWZyZXNoVG9rZW4sXG4gICAgICBjbGllbnRfaWQ6IHRoaXMuY2xpZW50SWQsXG4gICAgfTtcbiAgICBpZiAodGhpcy5jbGllbnRTZWNyZXQpIHtcbiAgICAgIHBhcmFtcy5jbGllbnRfc2VjcmV0ID0gdGhpcy5jbGllbnRTZWNyZXQ7XG4gICAgfVxuICAgIGNvbnN0IHJldCA9IGF3YWl0IHRoaXMuX3Bvc3RQYXJhbXMocGFyYW1zKTtcbiAgICByZXR1cm4gcmV0IGFzIFRva2VuUmVzcG9uc2U7XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhY2Nlc3MgdG9rZW4gcmVxdWVzdCB0byB0aGUgdG9rZW4gZW5kcG9pbnQuXG4gICAqIFdoZW4gYSBjb2RlIChzdHJpbmcpIGlzIHBhc3NlZCBpbiBmaXJzdCBhcmd1bWVudCwgaXQgd2lsbCB1c2UgV2ViIFNlcnZlciBBdXRoZW50aWNhdGlvbiBGbG93IChBdXRob3JpemF0aW9uIENvZGUgR3JhbnQpLlxuICAgKiBPdGhlcndpc2UsIGl0IHdpbGwgdXNlIHRoZSBzcGVjaWZpZWQgYGdyYW50X3R5cGVgIGFuZCBwYXNzIHBhcmFtZXRlcnMgdG8gdGhlIGVuZHBvaW50LlxuICAgKi9cbiAgYXN5bmMgcmVxdWVzdFRva2VuKFxuICAgIGNvZGVPclBhcmFtczogc3RyaW5nIHwgeyBncmFudF90eXBlOiBzdHJpbmc7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSxcbiAgICBwYXJhbXM6IHsgW3Byb3A6IHN0cmluZ106IHN0cmluZyB9ID0ge30sXG4gICk6IFByb21pc2U8VG9rZW5SZXNwb25zZT4ge1xuICAgIGlmIChcbiAgICAgIHR5cGVvZiBjb2RlT3JQYXJhbXMgPT09ICdzdHJpbmcnICYmXG4gICAgICAoIXRoaXMuY2xpZW50SWQgfHwgIXRoaXMucmVkaXJlY3RVcmkpXG4gICAgKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdObyBPQXV0aDIgY2xpZW50IGlkIG9yIHJlZGlyZWN0IHVyaSBjb25maWd1cmF0aW9uIGlzIHNwZWNpZmllZCcsXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCBfcGFyYW1zOiB7IFtwcm9wOiBzdHJpbmddOiBzdHJpbmcgfSA9IHtcbiAgICAgIC4uLnBhcmFtcyxcbiAgICAgIC4uLih0eXBlb2YgY29kZU9yUGFyYW1zID09PSAnc3RyaW5nJ1xuICAgICAgICA/IHsgZ3JhbnRfdHlwZTogJ2F1dGhvcml6YXRpb25fY29kZScsIGNvZGU6IGNvZGVPclBhcmFtcyB9XG4gICAgICAgIDogY29kZU9yUGFyYW1zKSxcbiAgICB9O1xuICAgIGlmICh0aGlzLmNsaWVudElkKSB7XG4gICAgICBfcGFyYW1zLmNsaWVudF9pZCA9IHRoaXMuY2xpZW50SWQ7XG4gICAgfVxuICAgIGlmICh0aGlzLmNsaWVudFNlY3JldCkge1xuICAgICAgX3BhcmFtcy5jbGllbnRfc2VjcmV0ID0gdGhpcy5jbGllbnRTZWNyZXQ7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlZGlyZWN0VXJpKSB7XG4gICAgICBfcGFyYW1zLnJlZGlyZWN0X3VyaSA9IHRoaXMucmVkaXJlY3RVcmk7XG4gICAgfVxuICAgIGNvbnN0IHJldCA9IGF3YWl0IHRoaXMuX3Bvc3RQYXJhbXMoX3BhcmFtcyk7XG4gICAgcmV0dXJuIHJldCBhcyBUb2tlblJlc3BvbnNlO1xuICB9XG5cbiAgLyoqXG4gICAqIE9BdXRoMiBVc2VybmFtZS1QYXNzd29yZCBGbG93IChSZXNvdXJjZSBPd25lciBQYXNzd29yZCBDcmVkZW50aWFscylcbiAgICovXG4gIGFzeW5jIGF1dGhlbnRpY2F0ZShcbiAgICB1c2VybmFtZTogc3RyaW5nLFxuICAgIHBhc3N3b3JkOiBzdHJpbmcsXG4gICk6IFByb21pc2U8VG9rZW5SZXNwb25zZT4ge1xuICAgIGlmICghdGhpcy5jbGllbnRJZCB8fCAhdGhpcy5jbGllbnRTZWNyZXQgfHwgIXRoaXMucmVkaXJlY3RVcmkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gdmFsaWQgT0F1dGgyIGNsaWVudCBjb25maWd1cmF0aW9uIHNldCcpO1xuICAgIH1cbiAgICBjb25zdCByZXQgPSBhd2FpdCB0aGlzLl9wb3N0UGFyYW1zKHtcbiAgICAgIGdyYW50X3R5cGU6ICdwYXNzd29yZCcsXG4gICAgICB1c2VybmFtZSxcbiAgICAgIHBhc3N3b3JkLFxuICAgICAgY2xpZW50X2lkOiB0aGlzLmNsaWVudElkLFxuICAgICAgY2xpZW50X3NlY3JldDogdGhpcy5jbGllbnRTZWNyZXQsXG4gICAgICByZWRpcmVjdF91cmk6IHRoaXMucmVkaXJlY3RVcmksXG4gICAgfSk7XG4gICAgcmV0dXJuIHJldCBhcyBUb2tlblJlc3BvbnNlO1xuICB9XG5cbiAgLyoqXG4gICAqIE9BdXRoMiBSZXZva2UgU2Vzc2lvbiBUb2tlblxuICAgKi9cbiAgYXN5bmMgcmV2b2tlVG9rZW4odG9rZW46IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fdHJhbnNwb3J0Lmh0dHBSZXF1ZXN0KHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgdXJsOiB0aGlzLnJldm9rZVNlcnZpY2VVcmwsXG4gICAgICBib2R5OiBxdWVyeXN0cmluZy5zdHJpbmdpZnkoeyB0b2tlbiB9KSxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgIGxldCByZXM6IGFueSA9IHF1ZXJ5c3RyaW5nLnBhcnNlKHJlc3BvbnNlLmJvZHkpO1xuICAgICAgaWYgKCFyZXMgfHwgIXJlcy5lcnJvcikge1xuICAgICAgICByZXMgPSB7XG4gICAgICAgICAgZXJyb3I6IGBFUlJPUl9IVFRQXyR7cmVzcG9uc2Uuc3RhdHVzQ29kZX1gLFxuICAgICAgICAgIGVycm9yX2Rlc2NyaXB0aW9uOiByZXNwb25zZS5ib2R5LFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhyb3cgbmV3IChjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgICAgICAgY29uc3RydWN0b3Ioe1xuICAgICAgICAgIGVycm9yLFxuICAgICAgICAgIGVycm9yX2Rlc2NyaXB0aW9uLFxuICAgICAgICB9OiB7XG4gICAgICAgICAgZXJyb3I6IHN0cmluZztcbiAgICAgICAgICBlcnJvcl9kZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgICAgICB9KSB7XG4gICAgICAgICAgc3VwZXIoZXJyb3JfZGVzY3JpcHRpb24pO1xuICAgICAgICAgIHRoaXMubmFtZSA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KShyZXMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX3Bvc3RQYXJhbXMocGFyYW1zOiB7IFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfSk6IFByb21pc2U8YW55PiB7XG4gICAgaWYgKHRoaXMuY29kZVZlcmlmaWVyKSBwYXJhbXMuY29kZV92ZXJpZmllciA9IHRoaXMuY29kZVZlcmlmaWVyO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl90cmFuc3BvcnQuaHR0cFJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmw6IHRoaXMudG9rZW5TZXJ2aWNlVXJsLFxuICAgICAgYm9keTogcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHBhcmFtcyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJyxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgbGV0IHJlcztcbiAgICB0cnkge1xuICAgICAgcmVzID0gSlNPTi5wYXJzZShyZXNwb25zZS5ib2R5KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1lbXB0eSAqL1xuICAgIH1cbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzQ29kZSA+PSA0MDApIHtcbiAgICAgIHJlcyA9IHJlcyB8fCB7XG4gICAgICAgIGVycm9yOiBgRVJST1JfSFRUUF8ke3Jlc3BvbnNlLnN0YXR1c0NvZGV9YCxcbiAgICAgICAgZXJyb3JfZGVzY3JpcHRpb246IHJlc3BvbnNlLmJvZHksXG4gICAgICB9O1xuICAgICAgdGhyb3cgbmV3IChjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgICAgICAgY29uc3RydWN0b3Ioe1xuICAgICAgICAgIGVycm9yLFxuICAgICAgICAgIGVycm9yX2Rlc2NyaXB0aW9uLFxuICAgICAgICB9OiB7XG4gICAgICAgICAgZXJyb3I6IHN0cmluZztcbiAgICAgICAgICBlcnJvcl9kZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgICAgICB9KSB7XG4gICAgICAgICAgc3VwZXIoZXJyb3JfZGVzY3JpcHRpb24pO1xuICAgICAgICAgIHRoaXMubmFtZSA9IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9KShyZXMpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE9BdXRoMjtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBR0EsSUFBQUEsT0FBQSxHQUFBQyxPQUFBO0FBQ0EsSUFBQUMsWUFBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsVUFBQSxHQUFBQyx1QkFBQSxDQUFBSixPQUFBO0FBQThFLFNBQUFLLFFBQUFDLE1BQUEsRUFBQUMsY0FBQSxRQUFBQyxJQUFBLEdBQUFDLFlBQUEsQ0FBQUgsTUFBQSxPQUFBSSw2QkFBQSxRQUFBQyxPQUFBLEdBQUFELDZCQUFBLENBQUFKLE1BQUEsT0FBQUMsY0FBQSxFQUFBSSxPQUFBLEdBQUFDLHVCQUFBLENBQUFELE9BQUEsRUFBQUUsSUFBQSxDQUFBRixPQUFBLFlBQUFHLEdBQUEsV0FBQUMsZ0NBQUEsQ0FBQVQsTUFBQSxFQUFBUSxHQUFBLEVBQUFFLFVBQUEsTUFBQVIsSUFBQSxDQUFBUyxJQUFBLENBQUFDLEtBQUEsQ0FBQVYsSUFBQSxFQUFBRyxPQUFBLFlBQUFILElBQUE7QUFBQSxTQUFBVyxjQUFBQyxNQUFBLGFBQUFDLENBQUEsTUFBQUEsQ0FBQSxHQUFBQyxTQUFBLENBQUFDLE1BQUEsRUFBQUYsQ0FBQSxVQUFBRyxNQUFBLEdBQUFGLFNBQUEsQ0FBQUQsQ0FBQSxZQUFBQyxTQUFBLENBQUFELENBQUEsWUFBQUEsQ0FBQSxZQUFBSSxTQUFBLEVBQUFDLHdCQUFBLENBQUFELFNBQUEsR0FBQXBCLE9BQUEsQ0FBQXNCLE1BQUEsQ0FBQUgsTUFBQSxVQUFBWCxJQUFBLENBQUFZLFNBQUEsWUFBQUcsR0FBQSxRQUFBQyxnQkFBQSxDQUFBQyxPQUFBLEVBQUFWLE1BQUEsRUFBQVEsR0FBQSxFQUFBSixNQUFBLENBQUFJLEdBQUEsbUJBQUFHLGlDQUFBLElBQUFDLHdCQUFBLENBQUFaLE1BQUEsRUFBQVcsaUNBQUEsQ0FBQVAsTUFBQSxpQkFBQVMsU0FBQSxFQUFBUCx3QkFBQSxDQUFBTyxTQUFBLEdBQUE1QixPQUFBLENBQUFzQixNQUFBLENBQUFILE1BQUEsSUFBQVgsSUFBQSxDQUFBb0IsU0FBQSxZQUFBTCxHQUFBLElBQUFNLHNCQUFBLENBQUFkLE1BQUEsRUFBQVEsR0FBQSxFQUFBYixnQ0FBQSxDQUFBUyxNQUFBLEVBQUFJLEdBQUEsbUJBQUFSLE1BQUEsSUFMOUU7QUFDQTtBQUNBO0FBTUEsTUFBTWUsbUJBQW1CLEdBQUc7RUFDMUJDLFFBQVEsRUFBRTtBQUNaLENBQUM7O0FBRUQ7QUFDQTtBQUNBLFNBQVNDLGVBQWVBLENBQUNDLGFBQXFCLEVBQVU7RUFDdEQ7RUFDQTtFQUNBLE9BQU9BLGFBQWEsQ0FDakJDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQ25CQSxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUNuQkEsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7QUFDdEI7O0FBRUE7QUFDQTtBQUNBOztBQXVDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxNQUFNLENBQUM7RUFZbEI7QUFDRjtBQUNBO0VBQ0VDLFdBQVdBLENBQUNDLE1BQW9CLEVBQUU7SUFBQSxJQUFBYixnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUE7SUFBQSxJQUFBRCxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUE7SUFBQSxJQUFBRCxnQkFBQSxDQUFBQyxPQUFBO0lBQUEsSUFBQUQsZ0JBQUEsQ0FBQUMsT0FBQTtJQUFBLElBQUFELGdCQUFBLENBQUFDLE9BQUE7SUFDaEMsTUFBTTtNQUNKTSxRQUFRO01BQ1JPLGVBQWU7TUFDZkMsZUFBZTtNQUNmQyxnQkFBZ0I7TUFDaEJDLFFBQVE7TUFDUkMsWUFBWTtNQUNaQyxXQUFXO01BQ1hDLFFBQVE7TUFDUkMsU0FBUztNQUNUQztJQUNGLENBQUMsR0FBR1QsTUFBTTtJQUNWLElBQUlDLGVBQWUsSUFBSUMsZUFBZSxFQUFFO01BQUEsSUFBQVEsUUFBQTtNQUN0QyxJQUFJLENBQUNoQixRQUFRLEdBQUcsSUFBQWlCLE1BQUEsQ0FBQXZCLE9BQUEsRUFBQXNCLFFBQUEsR0FBQVQsZUFBZSxDQUFDVyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUF6QyxJQUFBLENBQUF1QyxRQUFBLEVBQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDRyxJQUFJLENBQUMsR0FBRyxDQUFDO01BQ2hFLElBQUksQ0FBQ1osZUFBZSxHQUFHQSxlQUFlO01BQ3RDLElBQUksQ0FBQ0MsZUFBZSxHQUFHQSxlQUFlO01BQ3RDLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQ25CQSxnQkFBZ0IsSUFBSyxHQUFFLElBQUksQ0FBQ1QsUUFBUyx5QkFBd0I7SUFDakUsQ0FBQyxNQUFNO01BQ0wsSUFBSSxDQUFDQSxRQUFRLEdBQUdBLFFBQVEsSUFBSUQsbUJBQW1CLENBQUNDLFFBQVE7TUFDeEQsSUFBSSxDQUFDTyxlQUFlLEdBQUksR0FBRSxJQUFJLENBQUNQLFFBQVMsNEJBQTJCO01BQ25FLElBQUksQ0FBQ1EsZUFBZSxHQUFJLEdBQUUsSUFBSSxDQUFDUixRQUFTLHdCQUF1QjtNQUMvRCxJQUFJLENBQUNTLGdCQUFnQixHQUFJLEdBQUUsSUFBSSxDQUFDVCxRQUFTLHlCQUF3QjtJQUNuRTtJQUNBLElBQUksQ0FBQ1UsUUFBUSxHQUFHQSxRQUFRO0lBQ3hCLElBQUksQ0FBQ0MsWUFBWSxHQUFHQSxZQUFZO0lBQ2hDLElBQUksQ0FBQ0MsV0FBVyxHQUFHQSxXQUFXO0lBQzlCLElBQUlDLFFBQVEsRUFBRTtNQUNaLElBQUksQ0FBQzlDLFVBQVUsR0FBRyxJQUFJcUQsMkJBQWdCLENBQUNQLFFBQVEsQ0FBQztJQUNsRCxDQUFDLE1BQU0sSUFBSUMsU0FBUyxFQUFFO01BQ3BCLElBQUksQ0FBQy9DLFVBQVUsR0FBRyxJQUFJc0QsNkJBQWtCLENBQUNQLFNBQVMsQ0FBQztJQUNyRCxDQUFDLE1BQU07TUFDTCxJQUFJLENBQUMvQyxVQUFVLEdBQUcsSUFBSXVELGtCQUFTLENBQUMsQ0FBQztJQUNuQztJQUNBLElBQUlQLFdBQVcsRUFBRTtNQUNmO01BQ0EsSUFBSSxDQUFDUSxZQUFZLEdBQUd0QixlQUFlLENBQ2pDLElBQUF1QixtQkFBVyxFQUFDQyxJQUFJLENBQUNDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDQyxRQUFRLENBQUMsUUFBUSxDQUMvQyxDQUFDO0lBQ0g7RUFDRjs7RUFFQTtBQUNGO0FBQ0E7RUFDRUMsbUJBQW1CQSxDQUFDQyxNQUEwQixHQUFHLENBQUMsQ0FBQyxFQUFFO0lBQUEsSUFBQUMsU0FBQTtJQUNuRCxJQUFJLElBQUksQ0FBQ1AsWUFBWSxFQUFFO01BQ3JCO01BQ0E7TUFDQSxNQUFNUSxhQUFhLEdBQUc5QixlQUFlLENBQ25DLElBQUErQixrQkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDVixZQUFZLENBQUMsQ0FBQ1csTUFBTSxDQUFDLFFBQVEsQ0FDaEUsQ0FBQztNQUNETCxNQUFNLENBQUNNLGNBQWMsR0FBR0osYUFBYTtJQUN2QztJQUVBLE1BQU1LLE9BQU8sR0FBQXJELGFBQUEsQ0FBQUEsYUFBQSxLQUNSOEMsTUFBTTtNQUNUUSxhQUFhLEVBQUUsTUFBTTtNQUNyQkMsU0FBUyxFQUFFLElBQUksQ0FBQzVCLFFBQVE7TUFDeEI2QixZQUFZLEVBQUUsSUFBSSxDQUFDM0I7SUFBVyxFQUMvQjtJQUNELE9BQ0UsSUFBSSxDQUFDTCxlQUFlLElBQ25CLElBQUFpQyxRQUFBLENBQUE5QyxPQUFBLEVBQUFvQyxTQUFBLE9BQUksQ0FBQ3ZCLGVBQWUsRUFBQTlCLElBQUEsQ0FBQXFELFNBQUEsRUFBUyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUNwRFcsb0JBQVcsQ0FBQ0MsU0FBUyxDQUFDTixPQUFrQyxDQUFDO0VBRTdEOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1PLFlBQVlBLENBQUNBLFlBQW9CLEVBQTBCO0lBQy9ELElBQUksQ0FBQyxJQUFJLENBQUNqQyxRQUFRLEVBQUU7TUFDbEIsTUFBTSxJQUFJa0MsS0FBSyxDQUFDLDhDQUE4QyxDQUFDO0lBQ2pFO0lBQ0EsTUFBTWYsTUFBa0MsR0FBRztNQUN6Q2dCLFVBQVUsRUFBRSxlQUFlO01BQzNCQyxhQUFhLEVBQUVILFlBQVk7TUFDM0JMLFNBQVMsRUFBRSxJQUFJLENBQUM1QjtJQUNsQixDQUFDO0lBQ0QsSUFBSSxJQUFJLENBQUNDLFlBQVksRUFBRTtNQUNyQmtCLE1BQU0sQ0FBQ2tCLGFBQWEsR0FBRyxJQUFJLENBQUNwQyxZQUFZO0lBQzFDO0lBQ0EsTUFBTXFDLEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQ0MsV0FBVyxDQUFDcEIsTUFBTSxDQUFDO0lBQzFDLE9BQU9tQixHQUFHO0VBQ1o7O0VBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtFQUNFLE1BQU1FLFlBQVlBLENBQ2hCQyxZQUFxRSxFQUNyRXRCLE1BQWtDLEdBQUcsQ0FBQyxDQUFDLEVBQ2Y7SUFDeEIsSUFDRSxPQUFPc0IsWUFBWSxLQUFLLFFBQVEsS0FDL0IsQ0FBQyxJQUFJLENBQUN6QyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUNFLFdBQVcsQ0FBQyxFQUNyQztNQUNBLE1BQU0sSUFBSWdDLEtBQUssQ0FDYixnRUFDRixDQUFDO0lBQ0g7SUFDQSxNQUFNUixPQUFtQyxHQUFBckQsYUFBQSxDQUFBQSxhQUFBLEtBQ3BDOEMsTUFBTSxHQUNMLE9BQU9zQixZQUFZLEtBQUssUUFBUSxHQUNoQztNQUFFTixVQUFVLEVBQUUsb0JBQW9CO01BQUVPLElBQUksRUFBRUQ7SUFBYSxDQUFDLEdBQ3hEQSxZQUFZLENBQ2pCO0lBQ0QsSUFBSSxJQUFJLENBQUN6QyxRQUFRLEVBQUU7TUFDakIwQixPQUFPLENBQUNFLFNBQVMsR0FBRyxJQUFJLENBQUM1QixRQUFRO0lBQ25DO0lBQ0EsSUFBSSxJQUFJLENBQUNDLFlBQVksRUFBRTtNQUNyQnlCLE9BQU8sQ0FBQ1csYUFBYSxHQUFHLElBQUksQ0FBQ3BDLFlBQVk7SUFDM0M7SUFDQSxJQUFJLElBQUksQ0FBQ0MsV0FBVyxFQUFFO01BQ3BCd0IsT0FBTyxDQUFDRyxZQUFZLEdBQUcsSUFBSSxDQUFDM0IsV0FBVztJQUN6QztJQUNBLE1BQU1vQyxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNDLFdBQVcsQ0FBQ2IsT0FBTyxDQUFDO0lBQzNDLE9BQU9ZLEdBQUc7RUFDWjs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNSyxZQUFZQSxDQUNoQkMsUUFBZ0IsRUFDaEJDLFFBQWdCLEVBQ1E7SUFDeEIsSUFBSSxDQUFDLElBQUksQ0FBQzdDLFFBQVEsSUFBSSxDQUFDLElBQUksQ0FBQ0MsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDQyxXQUFXLEVBQUU7TUFDN0QsTUFBTSxJQUFJZ0MsS0FBSyxDQUFDLDBDQUEwQyxDQUFDO0lBQzdEO0lBQ0EsTUFBTUksR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDQyxXQUFXLENBQUM7TUFDakNKLFVBQVUsRUFBRSxVQUFVO01BQ3RCUyxRQUFRO01BQ1JDLFFBQVE7TUFDUmpCLFNBQVMsRUFBRSxJQUFJLENBQUM1QixRQUFRO01BQ3hCcUMsYUFBYSxFQUFFLElBQUksQ0FBQ3BDLFlBQVk7TUFDaEM0QixZQUFZLEVBQUUsSUFBSSxDQUFDM0I7SUFDckIsQ0FBQyxDQUFDO0lBQ0YsT0FBT29DLEdBQUc7RUFDWjs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNUSxXQUFXQSxDQUFDQyxLQUFhLEVBQWlCO0lBQzlDLE1BQU1DLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQzNGLFVBQVUsQ0FBQzRGLFdBQVcsQ0FBQztNQUNqREMsTUFBTSxFQUFFLE1BQU07TUFDZEMsR0FBRyxFQUFFLElBQUksQ0FBQ3BELGdCQUFnQjtNQUMxQnFELElBQUksRUFBRXJCLG9CQUFXLENBQUNDLFNBQVMsQ0FBQztRQUFFZTtNQUFNLENBQUMsQ0FBQztNQUN0Q00sT0FBTyxFQUFFO1FBQ1AsY0FBYyxFQUFFO01BQ2xCO0lBQ0YsQ0FBQyxDQUFDO0lBQ0YsSUFBSUwsUUFBUSxDQUFDTSxVQUFVLElBQUksR0FBRyxFQUFFO01BQzlCLElBQUlDLEdBQVEsR0FBR3hCLG9CQUFXLENBQUN5QixLQUFLLENBQUNSLFFBQVEsQ0FBQ0ksSUFBSSxDQUFDO01BQy9DLElBQUksQ0FBQ0csR0FBRyxJQUFJLENBQUNBLEdBQUcsQ0FBQ0UsS0FBSyxFQUFFO1FBQ3RCRixHQUFHLEdBQUc7VUFDSkUsS0FBSyxFQUFHLGNBQWFULFFBQVEsQ0FBQ00sVUFBVyxFQUFDO1VBQzFDSSxpQkFBaUIsRUFBRVYsUUFBUSxDQUFDSTtRQUM5QixDQUFDO01BQ0g7TUFDQSxNQUFNLElBQUssY0FBY2xCLEtBQUssQ0FBQztRQUM3QnZDLFdBQVdBLENBQUM7VUFDVjhELEtBQUs7VUFDTEM7UUFJRixDQUFDLEVBQUU7VUFDRCxLQUFLLENBQUNBLGlCQUFpQixDQUFDO1VBQ3hCLElBQUksQ0FBQ0MsSUFBSSxHQUFHRixLQUFLO1FBQ25CO01BQ0YsQ0FBQyxDQUFFRixHQUFHLENBQUM7SUFDVDtFQUNGOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1oQixXQUFXQSxDQUFDcEIsTUFBa0MsRUFBZ0I7SUFDbEUsSUFBSSxJQUFJLENBQUNOLFlBQVksRUFBRU0sTUFBTSxDQUFDeUMsYUFBYSxHQUFHLElBQUksQ0FBQy9DLFlBQVk7SUFFL0QsTUFBTW1DLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQzNGLFVBQVUsQ0FBQzRGLFdBQVcsQ0FBQztNQUNqREMsTUFBTSxFQUFFLE1BQU07TUFDZEMsR0FBRyxFQUFFLElBQUksQ0FBQ3JELGVBQWU7TUFDekJzRCxJQUFJLEVBQUVyQixvQkFBVyxDQUFDQyxTQUFTLENBQUNiLE1BQU0sQ0FBQztNQUNuQ2tDLE9BQU8sRUFBRTtRQUNQLGNBQWMsRUFBRTtNQUNsQjtJQUNGLENBQUMsQ0FBQztJQUNGLElBQUlFLEdBQUc7SUFDUCxJQUFJO01BQ0ZBLEdBQUcsR0FBR00sSUFBSSxDQUFDTCxLQUFLLENBQUNSLFFBQVEsQ0FBQ0ksSUFBSSxDQUFDO0lBQ2pDLENBQUMsQ0FBQyxPQUFPVSxDQUFDLEVBQUU7TUFDVjtJQUFBO0lBRUYsSUFBSWQsUUFBUSxDQUFDTSxVQUFVLElBQUksR0FBRyxFQUFFO01BQzlCQyxHQUFHLEdBQUdBLEdBQUcsSUFBSTtRQUNYRSxLQUFLLEVBQUcsY0FBYVQsUUFBUSxDQUFDTSxVQUFXLEVBQUM7UUFDMUNJLGlCQUFpQixFQUFFVixRQUFRLENBQUNJO01BQzlCLENBQUM7TUFDRCxNQUFNLElBQUssY0FBY2xCLEtBQUssQ0FBQztRQUM3QnZDLFdBQVdBLENBQUM7VUFDVjhELEtBQUs7VUFDTEM7UUFJRixDQUFDLEVBQUU7VUFDRCxLQUFLLENBQUNBLGlCQUFpQixDQUFDO1VBQ3hCLElBQUksQ0FBQ0MsSUFBSSxHQUFHRixLQUFLO1FBQ25CO01BQ0YsQ0FBQyxDQUFFRixHQUFHLENBQUM7SUFDVDtJQUNBLE9BQU9BLEdBQUc7RUFDWjtBQUNGO0FBQUNRLE9BQUEsQ0FBQXJFLE1BQUEsR0FBQUEsTUFBQTtBQUFBLElBQUFzRSxRQUFBLEdBRWN0RSxNQUFNO0FBQUFxRSxPQUFBLENBQUEvRSxPQUFBLEdBQUFnRixRQUFBIn0=