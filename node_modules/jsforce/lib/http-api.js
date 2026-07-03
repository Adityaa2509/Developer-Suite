"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.HttpApi = void 0;
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _now = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/date/now"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _events = require("events");
var _xml2js = _interopRequireDefault(require("xml2js"));
var _logger = require("./util/logger");
var _promise = require("./util/promise");
var _csv = require("./csv");
var _stream = require("./util/stream");
/**
 *
 */

/** @private */
function parseJSON(str) {
  return JSON.parse(str);
}

/** @private */
async function parseXML(str) {
  return _xml2js.default.parseStringPromise(str, {
    explicitArray: false
  });
}

/** @private */
function parseText(str) {
  return str;
}

/**
 * HTTP based API class with authorization hook
 */
class HttpApi extends _events.EventEmitter {
  constructor(conn, options) {
    super();
    (0, _defineProperty2.default)(this, "_conn", void 0);
    (0, _defineProperty2.default)(this, "_logger", void 0);
    (0, _defineProperty2.default)(this, "_transport", void 0);
    (0, _defineProperty2.default)(this, "_responseType", void 0);
    (0, _defineProperty2.default)(this, "_noContentResponse", void 0);
    (0, _defineProperty2.default)(this, "_options", void 0);
    this._conn = conn;
    this._logger = conn._logLevel ? HttpApi._logger.createInstance(conn._logLevel) : HttpApi._logger;
    this._responseType = options.responseType;
    this._transport = options.transport || conn._transport;
    this._noContentResponse = options.noContentResponse;
    this._options = options;
  }

  /**
   * Callout to API endpoint using http
   */
  request(request) {
    return _promise.StreamPromise.create(() => {
      const {
        stream,
        setStream
      } = (0, _stream.createLazyStream)();
      const promise = (async () => {
        const refreshDelegate = this.getRefreshDelegate();
        /* TODO decide remove or not this section */
        /*
        // remember previous instance url in case it changes after a refresh
        const lastInstanceUrl = conn.instanceUrl;
         // check to see if the token refresh has changed the instance url
        if(lastInstanceUrl !== conn.instanceUrl){
          // if the instance url has changed
          // then replace the current request urls instance url fragment
          // with the updated instance url
          request.url = request.url.replace(lastInstanceUrl,conn.instanceUrl);
        }
        */
        if (refreshDelegate && refreshDelegate.isRefreshing()) {
          await refreshDelegate.waitRefresh();
          const bodyPromise = this.request(request);
          setStream(bodyPromise.stream());
          const body = await bodyPromise;
          return body;
        }

        // hook before sending
        this.beforeSend(request);
        this.emit('request', request);
        this._logger.debug(`<request> method=${request.method}, url=${request.url}`);
        const requestTime = (0, _now.default)();
        const requestPromise = this._transport.httpRequest(request, this._options);
        setStream(requestPromise.stream());
        let response;
        try {
          response = await requestPromise;
        } catch (err) {
          this._logger.error(err);
          throw err;
        } finally {
          const responseTime = (0, _now.default)();
          this._logger.debug(`elapsed time: ${responseTime - requestTime} msec`);
        }
        if (!response) {
          return;
        }
        this._logger.debug(`<response> status=${String(response.statusCode)}, url=${request.url}`);
        this.emit('response', response);
        // Refresh token if session has been expired and requires authentication
        // when session refresh delegate is available
        if (this.isSessionExpired(response) && refreshDelegate) {
          await refreshDelegate.refresh(requestTime);
          return this.request(request);
        }
        if (this.isErrorResponse(response)) {
          const err = await this.getError(response);
          throw err;
        }
        const body = await this.getResponseBody(response);
        return body;
      })();
      return {
        stream,
        promise
      };
    });
  }

  /**
   * @protected
   */
  getRefreshDelegate() {
    return this._conn._refreshDelegate;
  }

  /**
   * @protected
   */
  beforeSend(request) {
    /* eslint-disable no-param-reassign */
    const headers = request.headers || {};
    if (this._conn.accessToken) {
      headers.Authorization = `Bearer ${this._conn.accessToken}`;
    }
    if (this._conn._callOptions) {
      const callOptions = [];
      for (const name of (0, _keys.default)(this._conn._callOptions)) {
        callOptions.push(`${name}=${this._conn._callOptions[name]}`);
      }
      headers['Sforce-Call-Options'] = callOptions.join(', ');
    }
    request.headers = headers;
  }

  /**
   * Detect response content mime-type
   * @protected
   */
  getResponseContentType(response) {
    return this._responseType || response.headers && response.headers['content-type'];
  }

  /**
   * @private
   */
  async parseResponseBody(response) {
    const contentType = this.getResponseContentType(response) || '';
    const parseBody = /^(text|application)\/xml(;|$)/.test(contentType) ? parseXML : /^application\/json(;|$)/.test(contentType) ? parseJSON : /^text\/csv(;|$)/.test(contentType) ? _csv.parseCSV : parseText;
    try {
      return parseBody(response.body);
    } catch (e) {
      return response.body;
    }
  }

  /**
   * Get response body
   * @protected
   */
  async getResponseBody(response) {
    if (response.statusCode === 204) {
      // No Content
      return this._noContentResponse;
    }
    const body = await this.parseResponseBody(response);
    let err;
    if (this.hasErrorInResponseBody(body)) {
      err = await this.getError(response, body);
      throw err;
    }
    if (response.statusCode === 300) {
      // Multiple Choices
      throw new HttpApiError('Multiple records found', 'MULTIPLE_CHOICES', body);
    }
    return body;
  }

  /**
   * Detect session expiry
   * @protected
   */
  isSessionExpired(response) {
    return response.statusCode === 401;
  }

  /**
   * Detect error response
   * @protected
   */
  isErrorResponse(response) {
    return response.statusCode >= 400;
  }

  /**
   * Detect error in response body
   * @protected
   */
  hasErrorInResponseBody(_body) {
    return false;
  }

  /**
   * Parsing error message in response
   * @protected
   */
  parseError(body) {
    const errors = body;
    return (0, _isArray.default)(errors) ? errors[0] : errors;
  }

  /**
   * Get error message in response
   * @protected
   */
  async getError(response, body) {
    let error;
    try {
      error = this.parseError(body || (await this.parseResponseBody(response)));
    } catch (e) {
      // eslint-disable no-empty
    }
    error = typeof error === 'object' && error !== null && typeof error.message === 'string' ? error : {
      errorCode: `ERROR_HTTP_${response.statusCode}`,
      message: response.body
    };
    if (response.headers['content-type'] === 'text/html') {
      this._logger.debug(`html response.body: ${response.body}`);
      return new HttpApiError(`HTTP response contains html content.
Check that the org exists and can be reached.
See error.content for the full html response.`, error.errorCode, error.message);
    }
    return new HttpApiError(error.message, error.errorCode);
  }
}

/**
 *
 */
exports.HttpApi = HttpApi;
(0, _defineProperty2.default)(HttpApi, "_logger", (0, _logger.getLogger)('http-api'));
class HttpApiError extends Error {
  constructor(message, errorCode, content) {
    super(message);
    (0, _defineProperty2.default)(this, "errorCode", void 0);
    (0, _defineProperty2.default)(this, "content", void 0);
    this.name = errorCode || this.name;
    this.errorCode = this.name;
    this.content = content;
  }
}
var _default = HttpApi;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZXZlbnRzIiwicmVxdWlyZSIsIl94bWwyanMiLCJfaW50ZXJvcFJlcXVpcmVEZWZhdWx0IiwiX2xvZ2dlciIsIl9wcm9taXNlIiwiX2NzdiIsIl9zdHJlYW0iLCJwYXJzZUpTT04iLCJzdHIiLCJKU09OIiwicGFyc2UiLCJwYXJzZVhNTCIsInhtbDJqcyIsInBhcnNlU3RyaW5nUHJvbWlzZSIsImV4cGxpY2l0QXJyYXkiLCJwYXJzZVRleHQiLCJIdHRwQXBpIiwiRXZlbnRFbWl0dGVyIiwiY29uc3RydWN0b3IiLCJjb25uIiwib3B0aW9ucyIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX2Nvbm4iLCJfbG9nTGV2ZWwiLCJjcmVhdGVJbnN0YW5jZSIsIl9yZXNwb25zZVR5cGUiLCJyZXNwb25zZVR5cGUiLCJfdHJhbnNwb3J0IiwidHJhbnNwb3J0IiwiX25vQ29udGVudFJlc3BvbnNlIiwibm9Db250ZW50UmVzcG9uc2UiLCJfb3B0aW9ucyIsInJlcXVlc3QiLCJTdHJlYW1Qcm9taXNlIiwiY3JlYXRlIiwic3RyZWFtIiwic2V0U3RyZWFtIiwiY3JlYXRlTGF6eVN0cmVhbSIsInByb21pc2UiLCJyZWZyZXNoRGVsZWdhdGUiLCJnZXRSZWZyZXNoRGVsZWdhdGUiLCJpc1JlZnJlc2hpbmciLCJ3YWl0UmVmcmVzaCIsImJvZHlQcm9taXNlIiwiYm9keSIsImJlZm9yZVNlbmQiLCJlbWl0IiwiZGVidWciLCJtZXRob2QiLCJ1cmwiLCJyZXF1ZXN0VGltZSIsIl9ub3ciLCJyZXF1ZXN0UHJvbWlzZSIsImh0dHBSZXF1ZXN0IiwicmVzcG9uc2UiLCJlcnIiLCJlcnJvciIsInJlc3BvbnNlVGltZSIsIlN0cmluZyIsInN0YXR1c0NvZGUiLCJpc1Nlc3Npb25FeHBpcmVkIiwicmVmcmVzaCIsImlzRXJyb3JSZXNwb25zZSIsImdldEVycm9yIiwiZ2V0UmVzcG9uc2VCb2R5IiwiX3JlZnJlc2hEZWxlZ2F0ZSIsImhlYWRlcnMiLCJhY2Nlc3NUb2tlbiIsIkF1dGhvcml6YXRpb24iLCJfY2FsbE9wdGlvbnMiLCJjYWxsT3B0aW9ucyIsIm5hbWUiLCJfa2V5cyIsInB1c2giLCJqb2luIiwiZ2V0UmVzcG9uc2VDb250ZW50VHlwZSIsInBhcnNlUmVzcG9uc2VCb2R5IiwiY29udGVudFR5cGUiLCJwYXJzZUJvZHkiLCJ0ZXN0IiwicGFyc2VDU1YiLCJlIiwiaGFzRXJyb3JJblJlc3BvbnNlQm9keSIsIkh0dHBBcGlFcnJvciIsIl9ib2R5IiwicGFyc2VFcnJvciIsImVycm9ycyIsIl9pc0FycmF5IiwibWVzc2FnZSIsImVycm9yQ29kZSIsImV4cG9ydHMiLCJnZXRMb2dnZXIiLCJFcnJvciIsImNvbnRlbnQiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uL3NyYy9odHRwLWFwaS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqXG4gKi9cbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XG5pbXBvcnQgeG1sMmpzIGZyb20gJ3htbDJqcyc7XG5pbXBvcnQgeyBMb2dnZXIsIGdldExvZ2dlciB9IGZyb20gJy4vdXRpbC9sb2dnZXInO1xuaW1wb3J0IHsgU3RyZWFtUHJvbWlzZSB9IGZyb20gJy4vdXRpbC9wcm9taXNlJztcbmltcG9ydCBDb25uZWN0aW9uIGZyb20gJy4vY29ubmVjdGlvbic7XG5pbXBvcnQgVHJhbnNwb3J0IGZyb20gJy4vdHJhbnNwb3J0JztcbmltcG9ydCB7IHBhcnNlQ1NWIH0gZnJvbSAnLi9jc3YnO1xuaW1wb3J0IHtcbiAgSHR0cFJlcXVlc3QsXG4gIEh0dHBSZXF1ZXN0T3B0aW9ucyxcbiAgSHR0cFJlc3BvbnNlLFxuICBPcHRpb25hbCxcbiAgU2NoZW1hLFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IGNyZWF0ZUxhenlTdHJlYW0gfSBmcm9tICcuL3V0aWwvc3RyZWFtJztcblxuLyoqIEBwcml2YXRlICovXG5mdW5jdGlvbiBwYXJzZUpTT04oc3RyOiBzdHJpbmcpIHtcbiAgcmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcbn1cblxuLyoqIEBwcml2YXRlICovXG5hc3luYyBmdW5jdGlvbiBwYXJzZVhNTChzdHI6IHN0cmluZykge1xuICByZXR1cm4geG1sMmpzLnBhcnNlU3RyaW5nUHJvbWlzZShzdHIsIHsgZXhwbGljaXRBcnJheTogZmFsc2UgfSk7XG59XG5cbi8qKiBAcHJpdmF0ZSAqL1xuZnVuY3Rpb24gcGFyc2VUZXh0KHN0cjogc3RyaW5nKSB7XG4gIHJldHVybiBzdHI7XG59XG5cbi8qKlxuICogSFRUUCBiYXNlZCBBUEkgY2xhc3Mgd2l0aCBhdXRob3JpemF0aW9uIGhvb2tcbiAqL1xuZXhwb3J0IGNsYXNzIEh0dHBBcGk8UyBleHRlbmRzIFNjaGVtYT4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBzdGF0aWMgX2xvZ2dlciA9IGdldExvZ2dlcignaHR0cC1hcGknKTtcblxuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcbiAgX2xvZ2dlcjogTG9nZ2VyO1xuICBfdHJhbnNwb3J0OiBUcmFuc3BvcnQ7XG4gIF9yZXNwb25zZVR5cGU6IHN0cmluZyB8IHZvaWQ7XG4gIF9ub0NvbnRlbnRSZXNwb25zZTogc3RyaW5nIHwgdm9pZDtcbiAgX29wdGlvbnM6IEh0dHBSZXF1ZXN0T3B0aW9ucztcblxuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+LCBvcHRpb25zOiBhbnkpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMuX2Nvbm4gPSBjb25uO1xuICAgIHRoaXMuX2xvZ2dlciA9IGNvbm4uX2xvZ0xldmVsXG4gICAgICA/IEh0dHBBcGkuX2xvZ2dlci5jcmVhdGVJbnN0YW5jZShjb25uLl9sb2dMZXZlbClcbiAgICAgIDogSHR0cEFwaS5fbG9nZ2VyO1xuICAgIHRoaXMuX3Jlc3BvbnNlVHlwZSA9IG9wdGlvbnMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuX3RyYW5zcG9ydCA9IG9wdGlvbnMudHJhbnNwb3J0IHx8IGNvbm4uX3RyYW5zcG9ydDtcbiAgICB0aGlzLl9ub0NvbnRlbnRSZXNwb25zZSA9IG9wdGlvbnMubm9Db250ZW50UmVzcG9uc2U7XG4gICAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cblxuICAvKipcbiAgICogQ2FsbG91dCB0byBBUEkgZW5kcG9pbnQgdXNpbmcgaHR0cFxuICAgKi9cbiAgcmVxdWVzdDxSID0gdW5rbm93bj4ocmVxdWVzdDogSHR0cFJlcXVlc3QpOiBTdHJlYW1Qcm9taXNlPFI+IHtcbiAgICByZXR1cm4gU3RyZWFtUHJvbWlzZS5jcmVhdGU8Uj4oKCkgPT4ge1xuICAgICAgY29uc3QgeyBzdHJlYW0sIHNldFN0cmVhbSB9ID0gY3JlYXRlTGF6eVN0cmVhbSgpO1xuICAgICAgY29uc3QgcHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlZnJlc2hEZWxlZ2F0ZSA9IHRoaXMuZ2V0UmVmcmVzaERlbGVnYXRlKCk7XG4gICAgICAgIC8qIFRPRE8gZGVjaWRlIHJlbW92ZSBvciBub3QgdGhpcyBzZWN0aW9uICovXG4gICAgICAgIC8qXG4gICAgICAgIC8vIHJlbWVtYmVyIHByZXZpb3VzIGluc3RhbmNlIHVybCBpbiBjYXNlIGl0IGNoYW5nZXMgYWZ0ZXIgYSByZWZyZXNoXG4gICAgICAgIGNvbnN0IGxhc3RJbnN0YW5jZVVybCA9IGNvbm4uaW5zdGFuY2VVcmw7XG5cbiAgICAgICAgLy8gY2hlY2sgdG8gc2VlIGlmIHRoZSB0b2tlbiByZWZyZXNoIGhhcyBjaGFuZ2VkIHRoZSBpbnN0YW5jZSB1cmxcbiAgICAgICAgaWYobGFzdEluc3RhbmNlVXJsICE9PSBjb25uLmluc3RhbmNlVXJsKXtcbiAgICAgICAgICAvLyBpZiB0aGUgaW5zdGFuY2UgdXJsIGhhcyBjaGFuZ2VkXG4gICAgICAgICAgLy8gdGhlbiByZXBsYWNlIHRoZSBjdXJyZW50IHJlcXVlc3QgdXJscyBpbnN0YW5jZSB1cmwgZnJhZ21lbnRcbiAgICAgICAgICAvLyB3aXRoIHRoZSB1cGRhdGVkIGluc3RhbmNlIHVybFxuICAgICAgICAgIHJlcXVlc3QudXJsID0gcmVxdWVzdC51cmwucmVwbGFjZShsYXN0SW5zdGFuY2VVcmwsY29ubi5pbnN0YW5jZVVybCk7XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICAgICAgaWYgKHJlZnJlc2hEZWxlZ2F0ZSAmJiByZWZyZXNoRGVsZWdhdGUuaXNSZWZyZXNoaW5nKCkpIHtcbiAgICAgICAgICBhd2FpdCByZWZyZXNoRGVsZWdhdGUud2FpdFJlZnJlc2goKTtcbiAgICAgICAgICBjb25zdCBib2R5UHJvbWlzZSA9IHRoaXMucmVxdWVzdChyZXF1ZXN0KTtcbiAgICAgICAgICBzZXRTdHJlYW0oYm9keVByb21pc2Uuc3RyZWFtKCkpO1xuICAgICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCBib2R5UHJvbWlzZTtcbiAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhvb2sgYmVmb3JlIHNlbmRpbmdcbiAgICAgICAgdGhpcy5iZWZvcmVTZW5kKHJlcXVlc3QpO1xuXG4gICAgICAgIHRoaXMuZW1pdCgncmVxdWVzdCcsIHJlcXVlc3QpO1xuICAgICAgICB0aGlzLl9sb2dnZXIuZGVidWcoXG4gICAgICAgICAgYDxyZXF1ZXN0PiBtZXRob2Q9JHtyZXF1ZXN0Lm1ldGhvZH0sIHVybD0ke3JlcXVlc3QudXJsfWAsXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RUaW1lID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc3QgcmVxdWVzdFByb21pc2UgPSB0aGlzLl90cmFuc3BvcnQuaHR0cFJlcXVlc3QoXG4gICAgICAgICAgcmVxdWVzdCxcbiAgICAgICAgICB0aGlzLl9vcHRpb25zLFxuICAgICAgICApO1xuXG4gICAgICAgIHNldFN0cmVhbShyZXF1ZXN0UHJvbWlzZS5zdHJlYW0oKSk7XG5cbiAgICAgICAgbGV0IHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UgfCB2b2lkO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJlc3BvbnNlID0gYXdhaXQgcmVxdWVzdFByb21pc2U7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHRoaXMuX2xvZ2dlci5lcnJvcihlcnIpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICBjb25zdCByZXNwb25zZVRpbWUgPSBEYXRlLm5vdygpO1xuICAgICAgICAgIHRoaXMuX2xvZ2dlci5kZWJ1ZyhcbiAgICAgICAgICAgIGBlbGFwc2VkIHRpbWU6ICR7cmVzcG9uc2VUaW1lIC0gcmVxdWVzdFRpbWV9IG1zZWNgLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFyZXNwb25zZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9sb2dnZXIuZGVidWcoXG4gICAgICAgICAgYDxyZXNwb25zZT4gc3RhdHVzPSR7U3RyaW5nKHJlc3BvbnNlLnN0YXR1c0NvZGUpfSwgdXJsPSR7XG4gICAgICAgICAgICByZXF1ZXN0LnVybFxuICAgICAgICAgIH1gLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmVtaXQoJ3Jlc3BvbnNlJywgcmVzcG9uc2UpO1xuICAgICAgICAvLyBSZWZyZXNoIHRva2VuIGlmIHNlc3Npb24gaGFzIGJlZW4gZXhwaXJlZCBhbmQgcmVxdWlyZXMgYXV0aGVudGljYXRpb25cbiAgICAgICAgLy8gd2hlbiBzZXNzaW9uIHJlZnJlc2ggZGVsZWdhdGUgaXMgYXZhaWxhYmxlXG4gICAgICAgIGlmICh0aGlzLmlzU2Vzc2lvbkV4cGlyZWQocmVzcG9uc2UpICYmIHJlZnJlc2hEZWxlZ2F0ZSkge1xuICAgICAgICAgIGF3YWl0IHJlZnJlc2hEZWxlZ2F0ZS5yZWZyZXNoKHJlcXVlc3RUaW1lKTtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHJlcXVlc3QpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmlzRXJyb3JSZXNwb25zZShyZXNwb25zZSkpIHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBhd2FpdCB0aGlzLmdldEVycm9yKHJlc3BvbnNlKTtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMuZ2V0UmVzcG9uc2VCb2R5KHJlc3BvbnNlKTtcbiAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICB9KSgpO1xuICAgICAgcmV0dXJuIHsgc3RyZWFtLCBwcm9taXNlIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgZ2V0UmVmcmVzaERlbGVnYXRlKCkge1xuICAgIHJldHVybiB0aGlzLl9jb25uLl9yZWZyZXNoRGVsZWdhdGU7XG4gIH1cblxuICAvKipcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgYmVmb3JlU2VuZChyZXF1ZXN0OiBIdHRwUmVxdWVzdCkge1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXBhcmFtLXJlYXNzaWduICovXG4gICAgY29uc3QgaGVhZGVycyA9IHJlcXVlc3QuaGVhZGVycyB8fCB7fTtcbiAgICBpZiAodGhpcy5fY29ubi5hY2Nlc3NUb2tlbikge1xuICAgICAgaGVhZGVycy5BdXRob3JpemF0aW9uID0gYEJlYXJlciAke3RoaXMuX2Nvbm4uYWNjZXNzVG9rZW59YDtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2Nvbm4uX2NhbGxPcHRpb25zKSB7XG4gICAgICBjb25zdCBjYWxsT3B0aW9ucyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHRoaXMuX2Nvbm4uX2NhbGxPcHRpb25zKSkge1xuICAgICAgICBjYWxsT3B0aW9ucy5wdXNoKGAke25hbWV9PSR7dGhpcy5fY29ubi5fY2FsbE9wdGlvbnNbbmFtZV19YCk7XG4gICAgICB9XG4gICAgICBoZWFkZXJzWydTZm9yY2UtQ2FsbC1PcHRpb25zJ10gPSBjYWxsT3B0aW9ucy5qb2luKCcsICcpO1xuICAgIH1cbiAgICByZXF1ZXN0LmhlYWRlcnMgPSBoZWFkZXJzO1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVjdCByZXNwb25zZSBjb250ZW50IG1pbWUtdHlwZVxuICAgKiBAcHJvdGVjdGVkXG4gICAqL1xuICBnZXRSZXNwb25zZUNvbnRlbnRUeXBlKHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UpOiBPcHRpb25hbDxzdHJpbmc+IHtcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fcmVzcG9uc2VUeXBlIHx8XG4gICAgICAocmVzcG9uc2UuaGVhZGVycyAmJiByZXNwb25zZS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSlcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBhc3luYyBwYXJzZVJlc3BvbnNlQm9keShyZXNwb25zZTogSHR0cFJlc3BvbnNlKSB7XG4gICAgY29uc3QgY29udGVudFR5cGUgPSB0aGlzLmdldFJlc3BvbnNlQ29udGVudFR5cGUocmVzcG9uc2UpIHx8ICcnO1xuICAgIGNvbnN0IHBhcnNlQm9keSA9IC9eKHRleHR8YXBwbGljYXRpb24pXFwveG1sKDt8JCkvLnRlc3QoY29udGVudFR5cGUpXG4gICAgICA/IHBhcnNlWE1MXG4gICAgICA6IC9eYXBwbGljYXRpb25cXC9qc29uKDt8JCkvLnRlc3QoY29udGVudFR5cGUpXG4gICAgICA/IHBhcnNlSlNPTlxuICAgICAgOiAvXnRleHRcXC9jc3YoO3wkKS8udGVzdChjb250ZW50VHlwZSlcbiAgICAgID8gcGFyc2VDU1ZcbiAgICAgIDogcGFyc2VUZXh0O1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gcGFyc2VCb2R5KHJlc3BvbnNlLmJvZHkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiByZXNwb25zZS5ib2R5O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcmVzcG9uc2UgYm9keVxuICAgKiBAcHJvdGVjdGVkXG4gICAqL1xuICBhc3luYyBnZXRSZXNwb25zZUJvZHkocmVzcG9uc2U6IEh0dHBSZXNwb25zZSkge1xuICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDQpIHtcbiAgICAgIC8vIE5vIENvbnRlbnRcbiAgICAgIHJldHVybiB0aGlzLl9ub0NvbnRlbnRSZXNwb25zZTtcbiAgICB9XG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHRoaXMucGFyc2VSZXNwb25zZUJvZHkocmVzcG9uc2UpO1xuICAgIGxldCBlcnI7XG4gICAgaWYgKHRoaXMuaGFzRXJyb3JJblJlc3BvbnNlQm9keShib2R5KSkge1xuICAgICAgZXJyID0gYXdhaXQgdGhpcy5nZXRFcnJvcihyZXNwb25zZSwgYm9keSk7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICAgIGlmIChyZXNwb25zZS5zdGF0dXNDb2RlID09PSAzMDApIHtcbiAgICAgIC8vIE11bHRpcGxlIENob2ljZXNcbiAgICAgIHRocm93IG5ldyBIdHRwQXBpRXJyb3IoXG4gICAgICAgICdNdWx0aXBsZSByZWNvcmRzIGZvdW5kJyxcbiAgICAgICAgJ01VTFRJUExFX0NIT0lDRVMnLFxuICAgICAgICBib2R5LFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIGJvZHk7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZWN0IHNlc3Npb24gZXhwaXJ5XG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIGlzU2Vzc2lvbkV4cGlyZWQocmVzcG9uc2U6IEh0dHBSZXNwb25zZSkge1xuICAgIHJldHVybiByZXNwb25zZS5zdGF0dXNDb2RlID09PSA0MDE7XG4gIH1cblxuICAvKipcbiAgICogRGV0ZWN0IGVycm9yIHJlc3BvbnNlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIGlzRXJyb3JSZXNwb25zZShyZXNwb25zZTogSHR0cFJlc3BvbnNlKSB7XG4gICAgcmV0dXJuIHJlc3BvbnNlLnN0YXR1c0NvZGUgPj0gNDAwO1xuICB9XG5cbiAgLyoqXG4gICAqIERldGVjdCBlcnJvciBpbiByZXNwb25zZSBib2R5XG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIGhhc0Vycm9ySW5SZXNwb25zZUJvZHkoX2JvZHk6IE9wdGlvbmFsPHN0cmluZz4pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogUGFyc2luZyBlcnJvciBtZXNzYWdlIGluIHJlc3BvbnNlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIHBhcnNlRXJyb3IoYm9keTogYW55KSB7XG4gICAgY29uc3QgZXJyb3JzID0gYm9keTtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShlcnJvcnMpID8gZXJyb3JzWzBdIDogZXJyb3JzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBlcnJvciBtZXNzYWdlIGluIHJlc3BvbnNlXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIGFzeW5jIGdldEVycm9yKHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UsIGJvZHk/OiBhbnkpOiBQcm9taXNlPEVycm9yPiB7XG4gICAgbGV0IGVycm9yO1xuICAgIHRyeSB7XG4gICAgICBlcnJvciA9IHRoaXMucGFyc2VFcnJvcihib2R5IHx8IChhd2FpdCB0aGlzLnBhcnNlUmVzcG9uc2VCb2R5KHJlc3BvbnNlKSkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlIG5vLWVtcHR5XG4gICAgfVxuICAgIGVycm9yID1cbiAgICAgIHR5cGVvZiBlcnJvciA9PT0gJ29iamVjdCcgJiZcbiAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICB0eXBlb2YgZXJyb3IubWVzc2FnZSA9PT0gJ3N0cmluZydcbiAgICAgICAgPyBlcnJvclxuICAgICAgICA6IHtcbiAgICAgICAgICAgIGVycm9yQ29kZTogYEVSUk9SX0hUVFBfJHtyZXNwb25zZS5zdGF0dXNDb2RlfWAsXG4gICAgICAgICAgICBtZXNzYWdlOiByZXNwb25zZS5ib2R5LFxuICAgICAgICAgIH07XG5cbiAgICBpZiAocmVzcG9uc2UuaGVhZGVyc1snY29udGVudC10eXBlJ10gPT09ICd0ZXh0L2h0bWwnKSB7XG4gICAgICB0aGlzLl9sb2dnZXIuZGVidWcoYGh0bWwgcmVzcG9uc2UuYm9keTogJHtyZXNwb25zZS5ib2R5fWApO1xuICAgICAgcmV0dXJuIG5ldyBIdHRwQXBpRXJyb3IoXG4gICAgICAgIGBIVFRQIHJlc3BvbnNlIGNvbnRhaW5zIGh0bWwgY29udGVudC5cbkNoZWNrIHRoYXQgdGhlIG9yZyBleGlzdHMgYW5kIGNhbiBiZSByZWFjaGVkLlxuU2VlIGVycm9yLmNvbnRlbnQgZm9yIHRoZSBmdWxsIGh0bWwgcmVzcG9uc2UuYCxcbiAgICAgICAgZXJyb3IuZXJyb3JDb2RlLFxuICAgICAgICBlcnJvci5tZXNzYWdlLFxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBIdHRwQXBpRXJyb3IoZXJyb3IubWVzc2FnZSwgZXJyb3IuZXJyb3JDb2RlKTtcbiAgfVxufVxuXG4vKipcbiAqXG4gKi9cbmNsYXNzIEh0dHBBcGlFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgZXJyb3JDb2RlOiBzdHJpbmc7XG4gIGNvbnRlbnQ6IGFueTtcbiAgY29uc3RydWN0b3IobWVzc2FnZTogc3RyaW5nLCBlcnJvckNvZGU/OiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvbnRlbnQ/OiBhbnkpIHtcbiAgICBzdXBlcihtZXNzYWdlKTtcbiAgICB0aGlzLm5hbWUgPSBlcnJvckNvZGUgfHwgdGhpcy5uYW1lO1xuICAgIHRoaXMuZXJyb3JDb2RlID0gdGhpcy5uYW1lO1xuICAgIHRoaXMuY29udGVudCA9IGNvbnRlbnQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgSHR0cEFwaTtcbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFHQSxJQUFBQSxPQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxPQUFBLEdBQUFDLHNCQUFBLENBQUFGLE9BQUE7QUFDQSxJQUFBRyxPQUFBLEdBQUFILE9BQUE7QUFDQSxJQUFBSSxRQUFBLEdBQUFKLE9BQUE7QUFHQSxJQUFBSyxJQUFBLEdBQUFMLE9BQUE7QUFRQSxJQUFBTSxPQUFBLEdBQUFOLE9BQUE7QUFqQkE7QUFDQTtBQUNB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