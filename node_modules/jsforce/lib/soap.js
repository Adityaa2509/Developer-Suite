"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys2 = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
require("core-js/modules/es.string.replace");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.castTypeUsingSchema = castTypeUsingSchema;
exports.default = exports.SOAP = void 0;
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _reduce = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/reduce"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _httpApi = _interopRequireDefault(require("./http-api"));
var _function = require("./util/function");
function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source), true)).call(_context3, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context4; _forEachInstanceProperty(_context4 = ownKeys(Object(source))).call(_context4, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @file Manages method call to SOAP endpoint
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
/**
 *
 */
function getPropsSchema(schema, schemaDict) {
  if (schema.extends && schemaDict[schema.extends]) {
    const extendSchema = schemaDict[schema.extends];
    return _objectSpread(_objectSpread({}, getPropsSchema(extendSchema, schemaDict)), schema.props);
  }
  return schema.props;
}
function isNillValue(value) {
  return value == null || (0, _function.isMapObject)(value) && (0, _function.isMapObject)(value.$) && value.$['xsi:nil'] === 'true';
}

/**
 *
 */
function castTypeUsingSchema(value, schema, schemaDict = {}) {
  if ((0, _isArray.default)(schema)) {
    var _context;
    const nillable = schema.length === 2 && schema[0] === '?';
    const schema_ = nillable ? schema[1] : schema[0];
    if (value == null) {
      return nillable ? null : [];
    }
    return (0, _map.default)(_context = (0, _isArray.default)(value) ? value : [value]).call(_context, v => castTypeUsingSchema(v, schema_, schemaDict));
  } else if ((0, _function.isMapObject)(schema)) {
    var _context2;
    // if schema is Schema Definition, not schema element
    if ('type' in schema && 'props' in schema && (0, _function.isMapObject)(schema.props)) {
      const props = getPropsSchema(schema, schemaDict);
      return castTypeUsingSchema(value, props, schemaDict);
    }
    const nillable = ('?' in schema);
    const schema_ = '?' in schema ? schema['?'] : schema;
    if (nillable && isNillValue(value)) {
      return null;
    }
    const obj = (0, _function.isMapObject)(value) ? value : {};
    return (0, _reduce.default)(_context2 = (0, _keys.default)(schema_)).call(_context2, (o, k) => {
      const s = schema_[k];
      const v = obj[k];
      const nillable = (0, _isArray.default)(s) && s.length === 2 && s[0] === '?' || (0, _function.isMapObject)(s) && '?' in s || typeof s === 'string' && s[0] === '?';
      if (typeof v === 'undefined' && nillable) {
        return o;
      }
      return _objectSpread(_objectSpread({}, o), {}, {
        [k]: castTypeUsingSchema(v, s, schemaDict)
      });
    }, obj);
  } else {
    const nillable = typeof schema === 'string' && schema[0] === '?';
    const type = typeof schema === 'string' ? nillable ? schema.substring(1) : schema : 'any';
    switch (type) {
      case 'string':
        return isNillValue(value) ? nillable ? null : '' : String(value);
      case 'number':
        return isNillValue(value) ? nillable ? null : 0 : Number(value);
      case 'boolean':
        return isNillValue(value) ? nillable ? null : false : value === 'true';
      case 'null':
        return null;
      default:
        {
          if (schemaDict[type]) {
            const cvalue = castTypeUsingSchema(value, schemaDict[type], schemaDict);
            const isEmpty = (0, _function.isMapObject)(cvalue) && (0, _keys.default)(cvalue).length === 0;
            return isEmpty && nillable ? null : cvalue;
          }
          return value;
        }
    }
  }
}

/**
 * @private
 */
function lookupValue(obj, propRegExps) {
  const regexp = propRegExps.shift();
  if (!regexp) {
    return obj;
  }
  if ((0, _function.isMapObject)(obj)) {
    for (const prop of (0, _keys.default)(obj)) {
      if (regexp.test(prop)) {
        return lookupValue(obj[prop], propRegExps);
      }
    }
    return null;
  }
}

/**
 * @private
 */
function toXML(name, value) {
  if ((0, _function.isObject)(name)) {
    value = name;
    name = null;
  }
  if ((0, _isArray.default)(value)) {
    return (0, _map.default)(value).call(value, v => toXML(name, v)).join('');
  } else {
    const attrs = [];
    const elems = [];
    if ((0, _function.isMapObject)(value)) {
      for (const k of (0, _keys.default)(value)) {
        const v = value[k];
        if (k[0] === '@') {
          const kk = k.substring(1);
          attrs.push(kk + '="' + v + '"');
        } else {
          elems.push(toXML(k, v));
        }
      }
      value = elems.join('');
    } else {
      value = String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }
    const startTag = name ? '<' + name + (attrs.length > 0 ? ' ' + attrs.join(' ') : '') + '>' : '';
    const endTag = name ? '</' + name + '>' : '';
    return startTag + value + endTag;
  }
}

/**
 *
 */

/**
 * Class for SOAP endpoint of Salesforce
 *
 * @protected
 * @class
 * @constructor
 * @param {Connection} conn - Connection instance
 * @param {Object} options - SOAP endpoint setting options
 * @param {String} options.endpointUrl - SOAP endpoint URL
 * @param {String} [options.xmlns] - XML namespace for method call (default is "urn:partner.soap.sforce.com")
 */
class SOAP extends _httpApi.default {
  constructor(conn, options) {
    super(conn, options);
    (0, _defineProperty2.default)(this, "_endpointUrl", void 0);
    (0, _defineProperty2.default)(this, "_xmlns", void 0);
    this._endpointUrl = options.endpointUrl;
    this._xmlns = options.xmlns || 'urn:partner.soap.sforce.com';
  }

  /**
   * Invoke SOAP call using method and arguments
   */
  async invoke(method, args, schema, schemaDict) {
    const res = await this.request({
      method: 'POST',
      url: this._endpointUrl,
      headers: {
        'Content-Type': 'text/xml',
        SOAPAction: '""'
      },
      _message: {
        [method]: args
      }
    });
    return schema ? castTypeUsingSchema(res, schema, schemaDict) : res;
  }

  /** @override */
  beforeSend(request) {
    request.body = this._createEnvelope(request._message);
  }

  /** @override **/
  isSessionExpired(response) {
    return response.statusCode === 500 && /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/.test(response.body);
  }

  /** @override **/
  parseError(body) {
    const error = lookupValue(body, [/:Envelope$/, /:Body$/, /:Fault$/]);
    return {
      errorCode: error.faultcode,
      message: error.faultstring
    };
  }

  /** @override **/
  async getResponseBody(response) {
    const body = await super.getResponseBody(response);
    return lookupValue(body, [/:Envelope$/, /:Body$/, /.+/]);
  }

  /**
   * @private
   */
  _createEnvelope(message) {
    const header = {};
    const conn = this._conn;
    if (conn.accessToken) {
      header.SessionHeader = {
        sessionId: conn.accessToken
      };
    }
    if (conn._callOptions) {
      header.CallOptions = conn._callOptions;
    }
    return ['<?xml version="1.0" encoding="UTF-8"?>', '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"', ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"', ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">', '<soapenv:Header xmlns="' + this._xmlns + '">', toXML(header), '</soapenv:Header>', '<soapenv:Body xmlns="' + this._xmlns + '">', toXML(message), '</soapenv:Body>', '</soapenv:Envelope>'].join('');
  }
}
exports.SOAP = SOAP;
var _default = SOAP;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfaHR0cEFwaSIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJyZXF1aXJlIiwiX2Z1bmN0aW9uIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIl9PYmplY3Qka2V5czIiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eSIsImNhbGwiLCJzeW0iLCJfT2JqZWN0JGdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImVudW1lcmFibGUiLCJwdXNoIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwidGFyZ2V0IiwiaSIsImFyZ3VtZW50cyIsImxlbmd0aCIsInNvdXJjZSIsIl9jb250ZXh0MyIsIl9mb3JFYWNoSW5zdGFuY2VQcm9wZXJ0eSIsIk9iamVjdCIsImtleSIsIl9kZWZpbmVQcm9wZXJ0eTIiLCJkZWZhdWx0IiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0aWVzIiwiX2NvbnRleHQ0IiwiX09iamVjdCRkZWZpbmVQcm9wZXJ0eSIsImdldFByb3BzU2NoZW1hIiwic2NoZW1hIiwic2NoZW1hRGljdCIsImV4dGVuZHMiLCJleHRlbmRTY2hlbWEiLCJwcm9wcyIsImlzTmlsbFZhbHVlIiwidmFsdWUiLCJpc01hcE9iamVjdCIsIiQiLCJjYXN0VHlwZVVzaW5nU2NoZW1hIiwiX2lzQXJyYXkiLCJfY29udGV4dCIsIm5pbGxhYmxlIiwic2NoZW1hXyIsIl9tYXAiLCJ2IiwiX2NvbnRleHQyIiwib2JqIiwiX3JlZHVjZSIsIl9rZXlzIiwibyIsImsiLCJzIiwidHlwZSIsInN1YnN0cmluZyIsIlN0cmluZyIsIk51bWJlciIsImN2YWx1ZSIsImlzRW1wdHkiLCJsb29rdXBWYWx1ZSIsInByb3BSZWdFeHBzIiwicmVnZXhwIiwic2hpZnQiLCJwcm9wIiwidGVzdCIsInRvWE1MIiwibmFtZSIsImlzT2JqZWN0Iiwiam9pbiIsImF0dHJzIiwiZWxlbXMiLCJrayIsInJlcGxhY2UiLCJzdGFydFRhZyIsImVuZFRhZyIsIlNPQVAiLCJIdHRwQXBpIiwiY29uc3RydWN0b3IiLCJjb25uIiwib3B0aW9ucyIsIl9lbmRwb2ludFVybCIsImVuZHBvaW50VXJsIiwiX3htbG5zIiwieG1sbnMiLCJpbnZva2UiLCJtZXRob2QiLCJhcmdzIiwicmVzIiwicmVxdWVzdCIsInVybCIsImhlYWRlcnMiLCJTT0FQQWN0aW9uIiwiX21lc3NhZ2UiLCJiZWZvcmVTZW5kIiwiYm9keSIsIl9jcmVhdGVFbnZlbG9wZSIsImlzU2Vzc2lvbkV4cGlyZWQiLCJyZXNwb25zZSIsInN0YXR1c0NvZGUiLCJwYXJzZUVycm9yIiwiZXJyb3IiLCJlcnJvckNvZGUiLCJmYXVsdGNvZGUiLCJtZXNzYWdlIiwiZmF1bHRzdHJpbmciLCJnZXRSZXNwb25zZUJvZHkiLCJoZWFkZXIiLCJfY29ubiIsImFjY2Vzc1Rva2VuIiwiU2Vzc2lvbkhlYWRlciIsInNlc3Npb25JZCIsIl9jYWxsT3B0aW9ucyIsIkNhbGxPcHRpb25zIiwiZXhwb3J0cyIsIl9kZWZhdWx0Il0sInNvdXJjZXMiOlsiLi4vc3JjL3NvYXAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZSBNYW5hZ2VzIG1ldGhvZCBjYWxsIHRvIFNPQVAgZW5kcG9pbnRcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgSHR0cEFwaSBmcm9tICcuL2h0dHAtYXBpJztcbmltcG9ydCBDb25uZWN0aW9uIGZyb20gJy4vY29ubmVjdGlvbic7XG5pbXBvcnQge1xuICBTY2hlbWEsXG4gIEh0dHBSZXNwb25zZSxcbiAgSHR0cFJlcXVlc3QsXG4gIFNvYXBTY2hlbWEsXG4gIFNvYXBTY2hlbWFEZWYsXG59IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHsgaXNNYXBPYmplY3QsIGlzT2JqZWN0IH0gZnJvbSAnLi91dGlsL2Z1bmN0aW9uJztcblxuLyoqXG4gKlxuICovXG5mdW5jdGlvbiBnZXRQcm9wc1NjaGVtYShcbiAgc2NoZW1hOiBTb2FwU2NoZW1hRGVmLFxuICBzY2hlbWFEaWN0OiB7IFtuYW1lOiBzdHJpbmddOiBTb2FwU2NoZW1hRGVmIH0sXG4pOiBTb2FwU2NoZW1hRGVmWydwcm9wcyddIHtcbiAgaWYgKHNjaGVtYS5leHRlbmRzICYmIHNjaGVtYURpY3Rbc2NoZW1hLmV4dGVuZHNdKSB7XG4gICAgY29uc3QgZXh0ZW5kU2NoZW1hID0gc2NoZW1hRGljdFtzY2hlbWEuZXh0ZW5kc107XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmdldFByb3BzU2NoZW1hKGV4dGVuZFNjaGVtYSwgc2NoZW1hRGljdCksXG4gICAgICAuLi5zY2hlbWEucHJvcHMsXG4gICAgfTtcbiAgfVxuICByZXR1cm4gc2NoZW1hLnByb3BzO1xufVxuXG5mdW5jdGlvbiBpc05pbGxWYWx1ZSh2YWx1ZTogdW5rbm93bikge1xuICByZXR1cm4gKFxuICAgIHZhbHVlID09IG51bGwgfHxcbiAgICAoaXNNYXBPYmplY3QodmFsdWUpICYmXG4gICAgICBpc01hcE9iamVjdCh2YWx1ZS4kKSAmJlxuICAgICAgdmFsdWUuJFsneHNpOm5pbCddID09PSAndHJ1ZScpXG4gICk7XG59XG5cbi8qKlxuICpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhc3RUeXBlVXNpbmdTY2hlbWEoXG4gIHZhbHVlOiB1bmtub3duLFxuICBzY2hlbWE/OiBTb2FwU2NoZW1hIHwgU29hcFNjaGVtYURlZixcbiAgc2NoZW1hRGljdDogeyBbbmFtZTogc3RyaW5nXTogU29hcFNjaGVtYURlZiB9ID0ge30sXG4pOiBhbnkge1xuICBpZiAoQXJyYXkuaXNBcnJheShzY2hlbWEpKSB7XG4gICAgY29uc3QgbmlsbGFibGUgPSBzY2hlbWEubGVuZ3RoID09PSAyICYmIHNjaGVtYVswXSA9PT0gJz8nO1xuICAgIGNvbnN0IHNjaGVtYV8gPSBuaWxsYWJsZSA/IHNjaGVtYVsxXSA6IHNjaGVtYVswXTtcbiAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG5pbGxhYmxlID8gbnVsbCA6IFtdO1xuICAgIH1cbiAgICByZXR1cm4gKEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUgOiBbdmFsdWVdKS5tYXAoKHYpID0+XG4gICAgICBjYXN0VHlwZVVzaW5nU2NoZW1hKHYsIHNjaGVtYV8sIHNjaGVtYURpY3QpLFxuICAgICk7XG4gIH0gZWxzZSBpZiAoaXNNYXBPYmplY3Qoc2NoZW1hKSkge1xuICAgIC8vIGlmIHNjaGVtYSBpcyBTY2hlbWEgRGVmaW5pdGlvbiwgbm90IHNjaGVtYSBlbGVtZW50XG4gICAgaWYgKCd0eXBlJyBpbiBzY2hlbWEgJiYgJ3Byb3BzJyBpbiBzY2hlbWEgJiYgaXNNYXBPYmplY3Qoc2NoZW1hLnByb3BzKSkge1xuICAgICAgY29uc3QgcHJvcHMgPSBnZXRQcm9wc1NjaGVtYShzY2hlbWEgYXMgU29hcFNjaGVtYURlZiwgc2NoZW1hRGljdCk7XG4gICAgICByZXR1cm4gY2FzdFR5cGVVc2luZ1NjaGVtYSh2YWx1ZSwgcHJvcHMsIHNjaGVtYURpY3QpO1xuICAgIH1cbiAgICBjb25zdCBuaWxsYWJsZSA9ICc/JyBpbiBzY2hlbWE7XG4gICAgY29uc3Qgc2NoZW1hXyA9XG4gICAgICAnPycgaW4gc2NoZW1hID8gKHNjaGVtYVsnPyddIGFzIHsgW2tleTogc3RyaW5nXTogYW55IH0pIDogc2NoZW1hO1xuICAgIGlmIChuaWxsYWJsZSAmJiBpc05pbGxWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBvYmogPSBpc01hcE9iamVjdCh2YWx1ZSkgPyB2YWx1ZSA6IHt9O1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhzY2hlbWFfKS5yZWR1Y2UoKG8sIGspID0+IHtcbiAgICAgIGNvbnN0IHMgPSBzY2hlbWFfW2tdO1xuICAgICAgY29uc3QgdiA9IG9ialtrXTtcbiAgICAgIGNvbnN0IG5pbGxhYmxlID1cbiAgICAgICAgKEFycmF5LmlzQXJyYXkocykgJiYgcy5sZW5ndGggPT09IDIgJiYgc1swXSA9PT0gJz8nKSB8fFxuICAgICAgICAoaXNNYXBPYmplY3QocykgJiYgJz8nIGluIHMpIHx8XG4gICAgICAgICh0eXBlb2YgcyA9PT0gJ3N0cmluZycgJiYgc1swXSA9PT0gJz8nKTtcbiAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ3VuZGVmaW5lZCcgJiYgbmlsbGFibGUpIHtcbiAgICAgICAgcmV0dXJuIG87XG4gICAgICB9XG4gICAgICByZXR1cm4ge1xuICAgICAgICAuLi5vLFxuICAgICAgICBba106IGNhc3RUeXBlVXNpbmdTY2hlbWEodiwgcywgc2NoZW1hRGljdCksXG4gICAgICB9O1xuICAgIH0sIG9iaik7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbmlsbGFibGUgPSB0eXBlb2Ygc2NoZW1hID09PSAnc3RyaW5nJyAmJiBzY2hlbWFbMF0gPT09ICc/JztcbiAgICBjb25zdCB0eXBlID1cbiAgICAgIHR5cGVvZiBzY2hlbWEgPT09ICdzdHJpbmcnXG4gICAgICAgID8gbmlsbGFibGVcbiAgICAgICAgICA/IHNjaGVtYS5zdWJzdHJpbmcoMSlcbiAgICAgICAgICA6IHNjaGVtYVxuICAgICAgICA6ICdhbnknO1xuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgcmV0dXJuIGlzTmlsbFZhbHVlKHZhbHVlKSA/IChuaWxsYWJsZSA/IG51bGwgOiAnJykgOiBTdHJpbmcodmFsdWUpO1xuICAgICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgICAgcmV0dXJuIGlzTmlsbFZhbHVlKHZhbHVlKSA/IChuaWxsYWJsZSA/IG51bGwgOiAwKSA6IE51bWJlcih2YWx1ZSk7XG4gICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgcmV0dXJuIGlzTmlsbFZhbHVlKHZhbHVlKVxuICAgICAgICAgID8gbmlsbGFibGVcbiAgICAgICAgICAgID8gbnVsbFxuICAgICAgICAgICAgOiBmYWxzZVxuICAgICAgICAgIDogdmFsdWUgPT09ICd0cnVlJztcbiAgICAgIGNhc2UgJ251bGwnOlxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgaWYgKHNjaGVtYURpY3RbdHlwZV0pIHtcbiAgICAgICAgICBjb25zdCBjdmFsdWUgPSBjYXN0VHlwZVVzaW5nU2NoZW1hKFxuICAgICAgICAgICAgdmFsdWUsXG4gICAgICAgICAgICBzY2hlbWFEaWN0W3R5cGVdLFxuICAgICAgICAgICAgc2NoZW1hRGljdCxcbiAgICAgICAgICApO1xuICAgICAgICAgIGNvbnN0IGlzRW1wdHkgPVxuICAgICAgICAgICAgaXNNYXBPYmplY3QoY3ZhbHVlKSAmJiBPYmplY3Qua2V5cyhjdmFsdWUpLmxlbmd0aCA9PT0gMDtcbiAgICAgICAgICByZXR1cm4gaXNFbXB0eSAmJiBuaWxsYWJsZSA/IG51bGwgOiBjdmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlIGFzIGFueTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBsb29rdXBWYWx1ZShvYmo6IHVua25vd24sIHByb3BSZWdFeHBzOiBSZWdFeHBbXSk6IHVua25vd24ge1xuICBjb25zdCByZWdleHAgPSBwcm9wUmVnRXhwcy5zaGlmdCgpO1xuICBpZiAoIXJlZ2V4cCkge1xuICAgIHJldHVybiBvYmo7XG4gIH1cbiAgaWYgKGlzTWFwT2JqZWN0KG9iaikpIHtcbiAgICBmb3IgKGNvbnN0IHByb3Agb2YgT2JqZWN0LmtleXMob2JqKSkge1xuICAgICAgaWYgKHJlZ2V4cC50ZXN0KHByb3ApKSB7XG4gICAgICAgIHJldHVybiBsb29rdXBWYWx1ZShvYmpbcHJvcF0sIHByb3BSZWdFeHBzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiB0b1hNTChuYW1lOiBvYmplY3QgfCBzdHJpbmcgfCBudWxsLCB2YWx1ZT86IGFueSk6IHN0cmluZyB7XG4gIGlmIChpc09iamVjdChuYW1lKSkge1xuICAgIHZhbHVlID0gbmFtZTtcbiAgICBuYW1lID0gbnVsbDtcbiAgfVxuICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUubWFwKCh2KSA9PiB0b1hNTChuYW1lLCB2KSkuam9pbignJyk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgYXR0cnMgPSBbXTtcbiAgICBjb25zdCBlbGVtcyA9IFtdO1xuICAgIGlmIChpc01hcE9iamVjdCh2YWx1ZSkpIHtcbiAgICAgIGZvciAoY29uc3QgayBvZiBPYmplY3Qua2V5cyh2YWx1ZSkpIHtcbiAgICAgICAgY29uc3QgdiA9IHZhbHVlW2tdO1xuICAgICAgICBpZiAoa1swXSA9PT0gJ0AnKSB7XG4gICAgICAgICAgY29uc3Qga2sgPSBrLnN1YnN0cmluZygxKTtcbiAgICAgICAgICBhdHRycy5wdXNoKGtrICsgJz1cIicgKyB2ICsgJ1wiJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWxlbXMucHVzaCh0b1hNTChrLCB2KSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhbHVlID0gZWxlbXMuam9pbignJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlID0gU3RyaW5nKHZhbHVlKVxuICAgICAgICAucmVwbGFjZSgvJi9nLCAnJmFtcDsnKVxuICAgICAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAgICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgICAgICAucmVwbGFjZSgvJy9nLCAnJmFwb3M7Jyk7XG4gICAgfVxuICAgIGNvbnN0IHN0YXJ0VGFnID0gbmFtZVxuICAgICAgPyAnPCcgKyBuYW1lICsgKGF0dHJzLmxlbmd0aCA+IDAgPyAnICcgKyBhdHRycy5qb2luKCcgJykgOiAnJykgKyAnPidcbiAgICAgIDogJyc7XG4gICAgY29uc3QgZW5kVGFnID0gbmFtZSA/ICc8LycgKyBuYW1lICsgJz4nIDogJyc7XG4gICAgcmV0dXJuIHN0YXJ0VGFnICsgdmFsdWUgKyBlbmRUYWc7XG4gIH1cbn1cblxuLyoqXG4gKlxuICovXG5leHBvcnQgdHlwZSBTT0FQT3B0aW9ucyA9IHtcbiAgZW5kcG9pbnRVcmw6IHN0cmluZztcbiAgeG1sbnM/OiBzdHJpbmc7XG59O1xuXG4vKipcbiAqIENsYXNzIGZvciBTT0FQIGVuZHBvaW50IG9mIFNhbGVzZm9yY2VcbiAqXG4gKiBAcHJvdGVjdGVkXG4gKiBAY2xhc3NcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtDb25uZWN0aW9ufSBjb25uIC0gQ29ubmVjdGlvbiBpbnN0YW5jZVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgLSBTT0FQIGVuZHBvaW50IHNldHRpbmcgb3B0aW9uc1xuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuZW5kcG9pbnRVcmwgLSBTT0FQIGVuZHBvaW50IFVSTFxuICogQHBhcmFtIHtTdHJpbmd9IFtvcHRpb25zLnhtbG5zXSAtIFhNTCBuYW1lc3BhY2UgZm9yIG1ldGhvZCBjYWxsIChkZWZhdWx0IGlzIFwidXJuOnBhcnRuZXIuc29hcC5zZm9yY2UuY29tXCIpXG4gKi9cbmV4cG9ydCBjbGFzcyBTT0FQPFMgZXh0ZW5kcyBTY2hlbWE+IGV4dGVuZHMgSHR0cEFwaTxTPiB7XG4gIF9lbmRwb2ludFVybDogc3RyaW5nO1xuICBfeG1sbnM6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+LCBvcHRpb25zOiBTT0FQT3B0aW9ucykge1xuICAgIHN1cGVyKGNvbm4sIG9wdGlvbnMpO1xuICAgIHRoaXMuX2VuZHBvaW50VXJsID0gb3B0aW9ucy5lbmRwb2ludFVybDtcbiAgICB0aGlzLl94bWxucyA9IG9wdGlvbnMueG1sbnMgfHwgJ3VybjpwYXJ0bmVyLnNvYXAuc2ZvcmNlLmNvbSc7XG4gIH1cblxuICAvKipcbiAgICogSW52b2tlIFNPQVAgY2FsbCB1c2luZyBtZXRob2QgYW5kIGFyZ3VtZW50c1xuICAgKi9cbiAgYXN5bmMgaW52b2tlKFxuICAgIG1ldGhvZDogc3RyaW5nLFxuICAgIGFyZ3M6IG9iamVjdCxcbiAgICBzY2hlbWE/OiBTb2FwU2NoZW1hIHwgU29hcFNjaGVtYURlZixcbiAgICBzY2hlbWFEaWN0PzogeyBbbmFtZTogc3RyaW5nXTogU29hcFNjaGVtYURlZiB9LFxuICApIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLnJlcXVlc3Qoe1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICB1cmw6IHRoaXMuX2VuZHBvaW50VXJsLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ3RleHQveG1sJyxcbiAgICAgICAgU09BUEFjdGlvbjogJ1wiXCInLFxuICAgICAgfSxcbiAgICAgIF9tZXNzYWdlOiB7IFttZXRob2RdOiBhcmdzIH0sXG4gICAgfSBhcyBIdHRwUmVxdWVzdCk7XG4gICAgcmV0dXJuIHNjaGVtYSA/IGNhc3RUeXBlVXNpbmdTY2hlbWEocmVzLCBzY2hlbWEsIHNjaGVtYURpY3QpIDogcmVzO1xuICB9XG5cbiAgLyoqIEBvdmVycmlkZSAqL1xuICBiZWZvcmVTZW5kKHJlcXVlc3Q6IEh0dHBSZXF1ZXN0ICYgeyBfbWVzc2FnZTogb2JqZWN0IH0pIHtcbiAgICByZXF1ZXN0LmJvZHkgPSB0aGlzLl9jcmVhdGVFbnZlbG9wZShyZXF1ZXN0Ll9tZXNzYWdlKTtcbiAgfVxuXG4gIC8qKiBAb3ZlcnJpZGUgKiovXG4gIGlzU2Vzc2lvbkV4cGlyZWQocmVzcG9uc2U6IEh0dHBSZXNwb25zZSkge1xuICAgIHJldHVybiAoXG4gICAgICByZXNwb25zZS5zdGF0dXNDb2RlID09PSA1MDAgJiZcbiAgICAgIC88ZmF1bHRjb2RlPlthLXpBLVpdKzpJTlZBTElEX1NFU1NJT05fSUQ8XFwvZmF1bHRjb2RlPi8udGVzdChyZXNwb25zZS5ib2R5KVxuICAgICk7XG4gIH1cblxuICAvKiogQG92ZXJyaWRlICoqL1xuICBwYXJzZUVycm9yKGJvZHk6IHN0cmluZykge1xuICAgIGNvbnN0IGVycm9yID0gbG9va3VwVmFsdWUoYm9keSwgWy86RW52ZWxvcGUkLywgLzpCb2R5JC8sIC86RmF1bHQkL10pIGFzIHtcbiAgICAgIFtuYW1lOiBzdHJpbmddOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICByZXR1cm4ge1xuICAgICAgZXJyb3JDb2RlOiBlcnJvci5mYXVsdGNvZGUsXG4gICAgICBtZXNzYWdlOiBlcnJvci5mYXVsdHN0cmluZyxcbiAgICB9O1xuICB9XG5cbiAgLyoqIEBvdmVycmlkZSAqKi9cbiAgYXN5bmMgZ2V0UmVzcG9uc2VCb2R5KHJlc3BvbnNlOiBIdHRwUmVzcG9uc2UpIHtcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgc3VwZXIuZ2V0UmVzcG9uc2VCb2R5KHJlc3BvbnNlKTtcbiAgICByZXR1cm4gbG9va3VwVmFsdWUoYm9keSwgWy86RW52ZWxvcGUkLywgLzpCb2R5JC8sIC8uKy9dKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2NyZWF0ZUVudmVsb3BlKG1lc3NhZ2U6IG9iamVjdCkge1xuICAgIGNvbnN0IGhlYWRlcjogeyBbbmFtZTogc3RyaW5nXTogYW55IH0gPSB7fTtcbiAgICBjb25zdCBjb25uID0gdGhpcy5fY29ubjtcbiAgICBpZiAoY29ubi5hY2Nlc3NUb2tlbikge1xuICAgICAgaGVhZGVyLlNlc3Npb25IZWFkZXIgPSB7IHNlc3Npb25JZDogY29ubi5hY2Nlc3NUb2tlbiB9O1xuICAgIH1cbiAgICBpZiAoY29ubi5fY2FsbE9wdGlvbnMpIHtcbiAgICAgIGhlYWRlci5DYWxsT3B0aW9ucyA9IGNvbm4uX2NhbGxPcHRpb25zO1xuICAgIH1cbiAgICByZXR1cm4gW1xuICAgICAgJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PicsXG4gICAgICAnPHNvYXBlbnY6RW52ZWxvcGUgeG1sbnM6c29hcGVudj1cImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3NvYXAvZW52ZWxvcGUvXCInLFxuICAgICAgJyB4bWxuczp4c2Q9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL1hNTFNjaGVtYVwiJyxcbiAgICAgICcgeG1sbnM6eHNpPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMS9YTUxTY2hlbWEtaW5zdGFuY2VcIj4nLFxuICAgICAgJzxzb2FwZW52OkhlYWRlciB4bWxucz1cIicgKyB0aGlzLl94bWxucyArICdcIj4nLFxuICAgICAgdG9YTUwoaGVhZGVyKSxcbiAgICAgICc8L3NvYXBlbnY6SGVhZGVyPicsXG4gICAgICAnPHNvYXBlbnY6Qm9keSB4bWxucz1cIicgKyB0aGlzLl94bWxucyArICdcIj4nLFxuICAgICAgdG9YTUwobWVzc2FnZSksXG4gICAgICAnPC9zb2FwZW52OkJvZHk+JyxcbiAgICAgICc8L3NvYXBlbnY6RW52ZWxvcGU+JyxcbiAgICBdLmpvaW4oJycpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNPQVA7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlBLElBQUFBLFFBQUEsR0FBQUMsc0JBQUEsQ0FBQUMsT0FBQTtBQVNBLElBQUFDLFNBQUEsR0FBQUQsT0FBQTtBQUF3RCxTQUFBRSxRQUFBQyxNQUFBLEVBQUFDLGNBQUEsUUFBQUMsSUFBQSxHQUFBQyxhQUFBLENBQUFILE1BQUEsT0FBQUksNkJBQUEsUUFBQUMsT0FBQSxHQUFBRCw2QkFBQSxDQUFBSixNQUFBLE9BQUFDLGNBQUEsRUFBQUksT0FBQSxHQUFBQyx1QkFBQSxDQUFBRCxPQUFBLEVBQUFFLElBQUEsQ0FBQUYsT0FBQSxZQUFBRyxHQUFBLFdBQUFDLGdDQUFBLENBQUFULE1BQUEsRUFBQVEsR0FBQSxFQUFBRSxVQUFBLE1BQUFSLElBQUEsQ0FBQVMsSUFBQSxDQUFBQyxLQUFBLENBQUFWLElBQUEsRUFBQUcsT0FBQSxZQUFB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