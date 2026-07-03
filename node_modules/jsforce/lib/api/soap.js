"use strict";

var _interopRequireDefault = require("@babel/runtime-corejs3/helpers/interopRequireDefault");
var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
var _Object$defineProperties = require("@babel/runtime-corejs3/core-js-stable/object/define-properties");
var _Object$getOwnPropertyDescriptors = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptors");
var _forEachInstanceProperty = require("@babel/runtime-corejs3/core-js-stable/instance/for-each");
var _Object$getOwnPropertyDescriptor = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-descriptor");
var _filterInstanceProperty2 = require("@babel/runtime-corejs3/core-js-stable/instance/filter");
var _Object$getOwnPropertySymbols = require("@babel/runtime-corejs3/core-js-stable/object/get-own-property-symbols");
var _Object$keys2 = require("@babel/runtime-corejs3/core-js-stable/object/keys");
require("core-js/modules/es.array.iterator");
require("core-js/modules/es.promise");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.SoapApi = void 0;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/defineProperty"));
var _keys = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/object/keys"));
var _filter = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/filter"));
var _objectWithoutProperties2 = _interopRequireDefault(require("@babel/runtime-corejs3/helpers/objectWithoutProperties"));
var _isArray = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/array/is-array"));
var _map = _interopRequireDefault(require("@babel/runtime-corejs3/core-js-stable/instance/map"));
var _jsforce = require("../jsforce");
var _soap = _interopRequireDefault(require("../soap"));
var _schema = require("./soap/schema");
function ownKeys(object, enumerableOnly) { var keys = _Object$keys2(object); if (_Object$getOwnPropertySymbols) { var symbols = _Object$getOwnPropertySymbols(object); if (enumerableOnly) symbols = _filterInstanceProperty2(symbols).call(symbols, function (sym) { return _Object$getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { var _context3; _forEachInstanceProperty(_context3 = ownKeys(Object(source), true)).call(_context3, function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (_Object$getOwnPropertyDescriptors) { _Object$defineProperties(target, _Object$getOwnPropertyDescriptors(source)); } else { var _context4; _forEachInstanceProperty(_context4 = ownKeys(Object(source))).call(_context4, function (key) { _Object$defineProperty(target, key, _Object$getOwnPropertyDescriptor(source, key)); }); } } return target; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @file Salesforce SOAP API
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     * @author Shinichi Tomita <shinichi.tomita@gmail.com>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */
/**
 *
 */
function toSoapRecord(records) {
  var _context;
  return (0, _map.default)(_context = (0, _isArray.default)(records) ? records : [records]).call(_context, record => {
    var _context2;
    const {
        type,
        attributes
      } = record,
      rec = (0, _objectWithoutProperties2.default)(record, ["type", "attributes"]);
    const t = type || (attributes === null || attributes === void 0 ? void 0 : attributes.type);
    if (!t) {
      throw new Error('Given record is not including sObject type information');
    }
    const fieldsToNull = (0, _filter.default)(_context2 = (0, _keys.default)(rec)).call(_context2, field => record[field] === null);
    for (const field of fieldsToNull) {
      delete rec[field];
    }
    return fieldsToNull.length > 0 ? _objectSpread({
      type: t,
      fieldsToNull
    }, rec) : _objectSpread({
      type: t
    }, rec);
  });
}

/**
 * API class for Partner SOAP call
 */
class SoapApi {
  constructor(conn) {
    (0, _defineProperty2.default)(this, "_conn", void 0);
    this._conn = conn;
  }

  /**
   * Call SOAP Api (Partner) endpoint
   * @private
   */
  async _invoke(method, message, schema) {
    const soapEndpoint = new _soap.default(this._conn, {
      xmlns: 'urn:partner.soap.sforce.com',
      endpointUrl: `${this._conn.instanceUrl}/services/Soap/u/${this._conn.version}`
    });
    const res = await soapEndpoint.invoke(method, message, schema ? {
      result: schema
    } : undefined, _schema.ApiSchemas);
    return res.result;
  }

  /**
   * Converts a Lead into an Account, Contact, or (optionally) an Opportunity.
   */

  async convertLead(leadConverts) {
    const schema = (0, _isArray.default)(leadConverts) ? [_schema.ApiSchemas.LeadConvertResult] : _schema.ApiSchemas.LeadConvertResult;
    return this._invoke('convertLead', {
      leadConverts
    }, schema);
  }

  /**
   * Merge up to three records into one
   */

  async merge(mergeRequests) {
    const schema = (0, _isArray.default)(mergeRequests) ? [_schema.ApiSchemas.MergeResult] : _schema.ApiSchemas.MergeResult;
    return this._invoke('merge', {
      mergeRequests
    }, schema);
  }

  /**
   * Delete records from the recycle bin immediately
   */
  async emptyRecycleBin(ids) {
    return this._invoke('emptyRecycleBin', {
      ids
    }, [_schema.ApiSchemas.EmptyRecycleBinResult]);
  }

  /**
   * Returns information about the standard and custom apps available to the logged-in user
   */
  async describeTabs() {
    return this._invoke('describeTabs', {}, [_schema.ApiSchemas.DescribeTabSetResult]);
  }

  /**
   * Retrieves the current system timestamp (Coordinated Universal Time (UTC) time zone) from the API
   */
  async getServerTimestamp() {
    return this._invoke('getServerTimestamp', {}, _schema.ApiSchemas.GetServerTimestampResult);
  }

  /**
   * Retrieves personal information for the user associated with the current session
   */
  async getUserInfo() {
    return this._invoke('getUserInfo', {}, _schema.ApiSchemas.GetUserInfoResult);
  }

  /**
   * Sets the specified user’s password to the specified value
   */
  setPassword(userId, password) {
    return this._invoke('setPassword', {
      userId,
      password
    }, 'string');
  }

  /**
   * Resets the specified user’s password
   */
  resetPassword(userId) {
    return this._invoke('resetPassword', {
      userId
    }, _schema.ApiSchemas.ResetPasswordResult);
  }

  /**
   * Adds one or more new records to your organization’s data
   */

  create(sObjects) {
    const schema = (0, _isArray.default)(sObjects) ? [_schema.ApiSchemas.SaveResult] : _schema.ApiSchemas.SaveResult;
    const args = {
      '@xmlns': 'urn:partner.soap.sforce.com',
      '@xmlns:ns1': 'sobject.partner.soap.sforce.com',
      'ns1:sObjects': toSoapRecord(sObjects)
    };
    return this._invoke('create', args, schema);
  }

  /**
   * Updates one or more existing records in your organization’s data.
   */

  update(sObjects) {
    const schema = (0, _isArray.default)(sObjects) ? [_schema.ApiSchemas.SaveResult] : _schema.ApiSchemas.SaveResult;
    const args = {
      '@xmlns': 'urn:partner.soap.sforce.com',
      '@xmlns:ns1': 'sobject.partner.soap.sforce.com',
      'ns1:sObjects': toSoapRecord(sObjects)
    };
    return this._invoke('update', args, schema);
  }

  /**
   * Creates new records and updates existing records in your organization’s data.
   */

  upsert(externalIdFieldName, sObjects) {
    const schema = (0, _isArray.default)(sObjects) ? [_schema.ApiSchemas.UpsertResult] : _schema.ApiSchemas.UpsertResult;
    const args = {
      '@xmlns': 'urn:partner.soap.sforce.com',
      '@xmlns:ns1': 'sobject.partner.soap.sforce.com',
      'ns1:externalIDFieldName': externalIdFieldName,
      'ns1:sObjects': toSoapRecord(sObjects)
    };
    return this._invoke('upsert', args, schema);
  }

  /**
   * Deletes one or more records from your organization’s data
   */

  delete(ids) {
    const schema = (0, _isArray.default)(ids) ? [_schema.ApiSchemas.DeleteResult] : _schema.ApiSchemas.DeleteResult;
    const args = {
      '@xmlns': 'urn:partner.soap.sforce.com',
      '@xmlns:ns1': 'sobject.partner.soap.sforce.com',
      'ns1:ids': ids
    };
    return this._invoke('delete', args, schema);
  }
}

/*--------------------------------------------*/
/*
 * Register hook in connection instantiation for dynamically adding this API module features
 */
exports.SoapApi = SoapApi;
(0, _jsforce.registerModule)('soap', conn => new SoapApi(conn));
var _default = SoapApi;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfanNmb3JjZSIsInJlcXVpcmUiLCJfc29hcCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJfc2NoZW1hIiwib3duS2V5cyIsIm9iamVjdCIsImVudW1lcmFibGVPbmx5Iiwia2V5cyIsIl9PYmplY3Qka2V5czIiLCJfT2JqZWN0JGdldE93blByb3BlcnR5U3ltYm9scyIsInN5bWJvbHMiLCJfZmlsdGVySW5zdGFuY2VQcm9wZXJ0eTIiLCJjYWxsIiwic3ltIiwiX09iamVjdCRnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJlbnVtZXJhYmxlIiwicHVzaCIsImFwcGx5IiwiX29iamVjdFNwcmVhZCIsInRhcmdldCIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJzb3VyY2UiLCJfY29udGV4dDMiLCJfZm9yRWFjaEluc3RhbmNlUHJvcGVydHkiLCJPYmplY3QiLCJrZXkiLCJfZGVmaW5lUHJvcGVydHkyIiwiZGVmYXVsdCIsIl9PYmplY3QkZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsIl9PYmplY3QkZGVmaW5lUHJvcGVydGllcyIsIl9jb250ZXh0NCIsIl9PYmplY3QkZGVmaW5lUHJvcGVydHkiLCJ0b1NvYXBSZWNvcmQiLCJyZWNvcmRzIiwiX2NvbnRleHQiLCJfbWFwIiwiX2lzQXJyYXkiLCJyZWNvcmQiLCJfY29udGV4dDIiLCJ0eXBlIiwiYXR0cmlidXRlcyIsInJlYyIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllczIiLCJ0IiwiRXJyb3IiLCJmaWVsZHNUb051bGwiLCJfZmlsdGVyIiwiX2tleXMiLCJmaWVsZCIsIlNvYXBBcGkiLCJjb25zdHJ1Y3RvciIsImNvbm4iLCJfY29ubiIsIl9pbnZva2UiLCJtZXRob2QiLCJtZXNzYWdlIiwic2NoZW1hIiwic29hcEVuZHBvaW50IiwiU09BUCIsInhtbG5zIiwiZW5kcG9pbnRVcmwiLCJpbnN0YW5jZVVybCIsInZlcnNpb24iLCJyZXMiLCJpbnZva2UiLCJyZXN1bHQiLCJ1bmRlZmluZWQiLCJBcGlTY2hlbWFzIiwiY29udmVydExlYWQiLCJsZWFkQ29udmVydHMiLCJMZWFkQ29udmVydFJlc3VsdCIsIm1lcmdlIiwibWVyZ2VSZXF1ZXN0cyIsIk1lcmdlUmVzdWx0IiwiZW1wdHlSZWN5Y2xlQmluIiwiaWRzIiwiRW1wdHlSZWN5Y2xlQmluUmVzdWx0IiwiZGVzY3JpYmVUYWJzIiwiRGVzY3JpYmVUYWJTZXRSZXN1bHQiLCJnZXRTZXJ2ZXJUaW1lc3RhbXAiLCJHZXRTZXJ2ZXJUaW1lc3RhbXBSZXN1bHQiLCJnZXRVc2VySW5mbyIsIkdldFVzZXJJbmZvUmVzdWx0Iiwic2V0UGFzc3dvcmQiLCJ1c2VySWQiLCJwYXNzd29yZCIsInJlc2V0UGFzc3dvcmQiLCJSZXNldFBhc3N3b3JkUmVzdWx0IiwiY3JlYXRlIiwic09iamVjdHMiLCJTYXZlUmVzdWx0IiwiYXJncyIsInVwZGF0ZSIsInVwc2VydCIsImV4dGVybmFsSWRGaWVsZE5hbWUiLCJVcHNlcnRSZXN1bHQiLCJkZWxldGUiLCJEZWxldGVSZXN1bHQiLCJleHBvcnRzIiwicmVnaXN0ZXJNb2R1bGUiLCJfZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9hcGkvc29hcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIFNhbGVzZm9yY2UgU09BUCBBUElcbiAqIEBhdXRob3IgU2hpbmljaGkgVG9taXRhIDxzaGluaWNoaS50b21pdGFAZ21haWwuY29tPlxuICovXG5pbXBvcnQgeyByZWdpc3Rlck1vZHVsZSB9IGZyb20gJy4uL2pzZm9yY2UnO1xuaW1wb3J0IENvbm5lY3Rpb24gZnJvbSAnLi4vY29ubmVjdGlvbic7XG5pbXBvcnQgU09BUCBmcm9tICcuLi9zb2FwJztcbmltcG9ydCB7IFNjaGVtYSwgUmVjb3JkLCBTb2FwU2NoZW1hRGVmLCBTb2FwU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHtcbiAgQXBpU2NoZW1hcyxcbiAgTGVhZENvbnZlcnQsXG4gIExlYWRDb252ZXJ0UmVzdWx0LFxuICBNZXJnZVJlcXVlc3QsXG4gIE1lcmdlUmVzdWx0LFxuICBFbXB0eVJlY3ljbGVCaW5SZXN1bHQsXG4gIERlc2NyaWJlVGFiU2V0UmVzdWx0LFxuICBHZXRTZXJ2ZXJUaW1lc3RhbXBSZXN1bHQsXG4gIEdldFVzZXJJbmZvUmVzdWx0LFxuICBSZXNldFBhc3N3b3JkUmVzdWx0LFxuICBTYXZlUmVzdWx0LFxuICBVcHNlcnRSZXN1bHQsXG4gIERlbGV0ZVJlc3VsdCxcbn0gZnJvbSAnLi9zb2FwL3NjaGVtYSc7XG5cbi8qKlxuICpcbiAqL1xuZnVuY3Rpb24gdG9Tb2FwUmVjb3JkKHJlY29yZHM6IFJlY29yZCB8IFJlY29yZFtdKTogUmVjb3JkIHwgUmVjb3JkW10ge1xuICByZXR1cm4gKEFycmF5LmlzQXJyYXkocmVjb3JkcykgPyByZWNvcmRzIDogW3JlY29yZHNdKS5tYXAoKHJlY29yZCkgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgYXR0cmlidXRlcywgLi4ucmVjIH0gPSByZWNvcmQ7XG4gICAgY29uc3QgdCA9IHR5cGUgfHwgYXR0cmlidXRlcz8udHlwZTtcbiAgICBpZiAoIXQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignR2l2ZW4gcmVjb3JkIGlzIG5vdCBpbmNsdWRpbmcgc09iamVjdCB0eXBlIGluZm9ybWF0aW9uJyk7XG4gICAgfVxuICAgIGNvbnN0IGZpZWxkc1RvTnVsbCA9IE9iamVjdC5rZXlzKHJlYykuZmlsdGVyKFxuICAgICAgKGZpZWxkKSA9PiByZWNvcmRbZmllbGRdID09PSBudWxsLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBmaWVsZCBvZiBmaWVsZHNUb051bGwpIHtcbiAgICAgIGRlbGV0ZSByZWNbZmllbGRdO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGRzVG9OdWxsLmxlbmd0aCA+IDBcbiAgICAgID8geyB0eXBlOiB0LCBmaWVsZHNUb051bGwsIC4uLnJlYyB9XG4gICAgICA6IHsgdHlwZTogdCwgLi4ucmVjIH07XG4gIH0pO1xufVxuXG4vKipcbiAqIEFQSSBjbGFzcyBmb3IgUGFydG5lciBTT0FQIGNhbGxcbiAqL1xuZXhwb3J0IGNsYXNzIFNvYXBBcGk8UyBleHRlbmRzIFNjaGVtYT4ge1xuICBfY29ubjogQ29ubmVjdGlvbjxTPjtcblxuICBjb25zdHJ1Y3Rvcihjb25uOiBDb25uZWN0aW9uPFM+KSB7XG4gICAgdGhpcy5fY29ubiA9IGNvbm47XG4gIH1cblxuICAvKipcbiAgICogQ2FsbCBTT0FQIEFwaSAoUGFydG5lcikgZW5kcG9pbnRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIGFzeW5jIF9pbnZva2UoXG4gICAgbWV0aG9kOiBzdHJpbmcsXG4gICAgbWVzc2FnZTogb2JqZWN0LFxuICAgIHNjaGVtYTogU29hcFNjaGVtYSB8IFNvYXBTY2hlbWFEZWYsXG4gICkge1xuICAgIGNvbnN0IHNvYXBFbmRwb2ludCA9IG5ldyBTT0FQKHRoaXMuX2Nvbm4sIHtcbiAgICAgIHhtbG5zOiAndXJuOnBhcnRuZXIuc29hcC5zZm9yY2UuY29tJyxcbiAgICAgIGVuZHBvaW50VXJsOiBgJHt0aGlzLl9jb25uLmluc3RhbmNlVXJsfS9zZXJ2aWNlcy9Tb2FwL3UvJHt0aGlzLl9jb25uLnZlcnNpb259YCxcbiAgICB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBzb2FwRW5kcG9pbnQuaW52b2tlKFxuICAgICAgbWV0aG9kLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIHNjaGVtYSA/ICh7IHJlc3VsdDogc2NoZW1hIH0gYXMgU29hcFNjaGVtYSkgOiB1bmRlZmluZWQsXG4gICAgICBBcGlTY2hlbWFzLFxuICAgICk7XG4gICAgcmV0dXJuIHJlcy5yZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgYSBMZWFkIGludG8gYW4gQWNjb3VudCwgQ29udGFjdCwgb3IgKG9wdGlvbmFsbHkpIGFuIE9wcG9ydHVuaXR5LlxuICAgKi9cbiAgY29udmVydExlYWQoXG4gICAgbGVhZENvbnZlcnRzOiBQYXJ0aWFsPExlYWRDb252ZXJ0PltdLFxuICApOiBQcm9taXNlPExlYWRDb252ZXJ0UmVzdWx0W10+O1xuICBjb252ZXJ0TGVhZChsZWFkQ29udmVydDogUGFydGlhbDxMZWFkQ29udmVydD4pOiBQcm9taXNlPExlYWRDb252ZXJ0UmVzdWx0PjtcbiAgY29udmVydExlYWQoXG4gICAgbGVhZENvbnZlcnQ6IFBhcnRpYWw8TGVhZENvbnZlcnQ+IHwgUGFydGlhbDxMZWFkQ29udmVydD5bXSxcbiAgKTogUHJvbWlzZTxMZWFkQ29udmVydFJlc3VsdCB8IExlYWRDb252ZXJ0UmVzdWx0W10+O1xuICBhc3luYyBjb252ZXJ0TGVhZChcbiAgICBsZWFkQ29udmVydHM6IFBhcnRpYWw8TGVhZENvbnZlcnQ+IHwgUGFydGlhbDxMZWFkQ29udmVydD5bXSxcbiAgKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gQXJyYXkuaXNBcnJheShsZWFkQ29udmVydHMpXG4gICAgICA/IFtBcGlTY2hlbWFzLkxlYWRDb252ZXJ0UmVzdWx0XVxuICAgICAgOiBBcGlTY2hlbWFzLkxlYWRDb252ZXJ0UmVzdWx0O1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ2NvbnZlcnRMZWFkJywgeyBsZWFkQ29udmVydHMgfSwgc2NoZW1hKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNZXJnZSB1cCB0byB0aHJlZSByZWNvcmRzIGludG8gb25lXG4gICAqL1xuICBtZXJnZShtZXJnZVJlcXVlc3RzOiBQYXJ0aWFsPE1lcmdlUmVxdWVzdD5bXSk6IFByb21pc2U8TWVyZ2VSZXN1bHRbXT47XG4gIG1lcmdlKG1lcmdlUmVxdWVzdDogUGFydGlhbDxNZXJnZVJlcXVlc3Q+KTogUHJvbWlzZTxNZXJnZVJlc3VsdD47XG4gIG1lcmdlKFxuICAgIG1lcmdlUmVxdWVzdDogUGFydGlhbDxNZXJnZVJlcXVlc3Q+IHwgUGFydGlhbDxNZXJnZVJlcXVlc3Q+W10sXG4gICk6IFByb21pc2U8TWVyZ2VSZXN1bHQgfCBNZXJnZVJlc3VsdFtdPjtcbiAgYXN5bmMgbWVyZ2UobWVyZ2VSZXF1ZXN0czogUGFydGlhbDxNZXJnZVJlcXVlc3Q+IHwgUGFydGlhbDxNZXJnZVJlcXVlc3Q+W10pIHtcbiAgICBjb25zdCBzY2hlbWEgPSBBcnJheS5pc0FycmF5KG1lcmdlUmVxdWVzdHMpXG4gICAgICA/IFtBcGlTY2hlbWFzLk1lcmdlUmVzdWx0XVxuICAgICAgOiBBcGlTY2hlbWFzLk1lcmdlUmVzdWx0O1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ21lcmdlJywgeyBtZXJnZVJlcXVlc3RzIH0sIHNjaGVtYSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIHJlY29yZHMgZnJvbSB0aGUgcmVjeWNsZSBiaW4gaW1tZWRpYXRlbHlcbiAgICovXG4gIGFzeW5jIGVtcHR5UmVjeWNsZUJpbihpZHM6IHN0cmluZ1tdKTogUHJvbWlzZTxFbXB0eVJlY3ljbGVCaW5SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKCdlbXB0eVJlY3ljbGVCaW4nLCB7IGlkcyB9LCBbXG4gICAgICBBcGlTY2hlbWFzLkVtcHR5UmVjeWNsZUJpblJlc3VsdCxcbiAgICBdKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGluZm9ybWF0aW9uIGFib3V0IHRoZSBzdGFuZGFyZCBhbmQgY3VzdG9tIGFwcHMgYXZhaWxhYmxlIHRvIHRoZSBsb2dnZWQtaW4gdXNlclxuICAgKi9cbiAgYXN5bmMgZGVzY3JpYmVUYWJzKCk6IFByb21pc2U8RGVzY3JpYmVUYWJTZXRSZXN1bHRbXT4ge1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ2Rlc2NyaWJlVGFicycsIHt9LCBbQXBpU2NoZW1hcy5EZXNjcmliZVRhYlNldFJlc3VsdF0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgY3VycmVudCBzeXN0ZW0gdGltZXN0YW1wIChDb29yZGluYXRlZCBVbml2ZXJzYWwgVGltZSAoVVRDKSB0aW1lIHpvbmUpIGZyb20gdGhlIEFQSVxuICAgKi9cbiAgYXN5bmMgZ2V0U2VydmVyVGltZXN0YW1wKCk6IFByb21pc2U8R2V0U2VydmVyVGltZXN0YW1wUmVzdWx0PiB7XG4gICAgcmV0dXJuIHRoaXMuX2ludm9rZShcbiAgICAgICdnZXRTZXJ2ZXJUaW1lc3RhbXAnLFxuICAgICAge30sXG4gICAgICBBcGlTY2hlbWFzLkdldFNlcnZlclRpbWVzdGFtcFJlc3VsdCxcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyBwZXJzb25hbCBpbmZvcm1hdGlvbiBmb3IgdGhlIHVzZXIgYXNzb2NpYXRlZCB3aXRoIHRoZSBjdXJyZW50IHNlc3Npb25cbiAgICovXG4gIGFzeW5jIGdldFVzZXJJbmZvKCk6IFByb21pc2U8R2V0VXNlckluZm9SZXN1bHQ+IHtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKCdnZXRVc2VySW5mbycsIHt9LCBBcGlTY2hlbWFzLkdldFVzZXJJbmZvUmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgdXNlcuKAmXMgcGFzc3dvcmQgdG8gdGhlIHNwZWNpZmllZCB2YWx1ZVxuICAgKi9cbiAgc2V0UGFzc3dvcmQodXNlcklkOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ3NldFBhc3N3b3JkJywgeyB1c2VySWQsIHBhc3N3b3JkIH0sICdzdHJpbmcnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldHMgdGhlIHNwZWNpZmllZCB1c2Vy4oCZcyBwYXNzd29yZFxuICAgKi9cbiAgcmVzZXRQYXNzd29yZCh1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8UmVzZXRQYXNzd29yZFJlc3VsdD4ge1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoXG4gICAgICAncmVzZXRQYXNzd29yZCcsXG4gICAgICB7IHVzZXJJZCB9LFxuICAgICAgQXBpU2NoZW1hcy5SZXNldFBhc3N3b3JkUmVzdWx0LFxuICAgICk7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBvbmUgb3IgbW9yZSBuZXcgcmVjb3JkcyB0byB5b3VyIG9yZ2FuaXphdGlvbuKAmXMgZGF0YVxuICAgKi9cbiAgY3JlYXRlKHNPYmplY3Q6IFJlY29yZFtdKTogUHJvbWlzZTxTYXZlUmVzdWx0W10+O1xuICBjcmVhdGUoc09iamVjdDogUmVjb3JkKTogUHJvbWlzZTxTYXZlUmVzdWx0PjtcbiAgY3JlYXRlKHNPYmplY3RzOiBSZWNvcmQgfCBSZWNvcmRbXSk6IFByb21pc2U8U2F2ZVJlc3VsdCB8IFNhdmVSZXN1bHRbXT47XG4gIGNyZWF0ZShzT2JqZWN0czogUmVjb3JkIHwgUmVjb3JkW10pIHtcbiAgICBjb25zdCBzY2hlbWEgPSBBcnJheS5pc0FycmF5KHNPYmplY3RzKVxuICAgICAgPyBbQXBpU2NoZW1hcy5TYXZlUmVzdWx0XVxuICAgICAgOiBBcGlTY2hlbWFzLlNhdmVSZXN1bHQ7XG4gICAgY29uc3QgYXJncyA9IHtcbiAgICAgICdAeG1sbnMnOiAndXJuOnBhcnRuZXIuc29hcC5zZm9yY2UuY29tJyxcbiAgICAgICdAeG1sbnM6bnMxJzogJ3NvYmplY3QucGFydG5lci5zb2FwLnNmb3JjZS5jb20nLFxuICAgICAgJ25zMTpzT2JqZWN0cyc6IHRvU29hcFJlY29yZChzT2JqZWN0cyksXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5faW52b2tlKCdjcmVhdGUnLCBhcmdzLCBzY2hlbWEpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgb25lIG9yIG1vcmUgZXhpc3RpbmcgcmVjb3JkcyBpbiB5b3VyIG9yZ2FuaXphdGlvbuKAmXMgZGF0YS5cbiAgICovXG4gIHVwZGF0ZShzT2JqZWN0OiBSZWNvcmRbXSk6IFByb21pc2U8U2F2ZVJlc3VsdFtdPjtcbiAgdXBkYXRlKHNPYmplY3Q6IFJlY29yZCk6IFByb21pc2U8U2F2ZVJlc3VsdD47XG4gIHVwZGF0ZShzT2JqZWN0czogUmVjb3JkIHwgUmVjb3JkW10pOiBQcm9taXNlPFNhdmVSZXN1bHQgfCBTYXZlUmVzdWx0W10+O1xuICB1cGRhdGUoc09iamVjdHM6IFJlY29yZCB8IFJlY29yZFtdKSB7XG4gICAgY29uc3Qgc2NoZW1hID0gQXJyYXkuaXNBcnJheShzT2JqZWN0cylcbiAgICAgID8gW0FwaVNjaGVtYXMuU2F2ZVJlc3VsdF1cbiAgICAgIDogQXBpU2NoZW1hcy5TYXZlUmVzdWx0O1xuICAgIGNvbnN0IGFyZ3MgPSB7XG4gICAgICAnQHhtbG5zJzogJ3VybjpwYXJ0bmVyLnNvYXAuc2ZvcmNlLmNvbScsXG4gICAgICAnQHhtbG5zOm5zMSc6ICdzb2JqZWN0LnBhcnRuZXIuc29hcC5zZm9yY2UuY29tJyxcbiAgICAgICduczE6c09iamVjdHMnOiB0b1NvYXBSZWNvcmQoc09iamVjdHMpLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2ludm9rZSgndXBkYXRlJywgYXJncywgc2NoZW1hKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIG5ldyByZWNvcmRzIGFuZCB1cGRhdGVzIGV4aXN0aW5nIHJlY29yZHMgaW4geW91ciBvcmdhbml6YXRpb27igJlzIGRhdGEuXG4gICAqL1xuICB1cHNlcnQoXG4gICAgZXh0ZXJuYWxJZEZpZWxkTmFtZTogc3RyaW5nLFxuICAgIHNPYmplY3RzOiBSZWNvcmRbXSxcbiAgKTogUHJvbWlzZTxVcHNlcnRSZXN1bHRbXT47XG4gIHVwc2VydChleHRlcm5hbElkRmllbGROYW1lOiBzdHJpbmcsIHNPYmplY3Q6IFJlY29yZCk6IFByb21pc2U8VXBzZXJ0UmVzdWx0PjtcbiAgdXBzZXJ0KFxuICAgIGV4dGVybmFsSWRGaWVsZE5hbWU6IHN0cmluZyxcbiAgICBzT2JqZWN0czogUmVjb3JkIHwgUmVjb3JkW10sXG4gICk6IFByb21pc2U8VXBzZXJ0UmVzdWx0IHwgVXBzZXJ0UmVzdWx0W10+O1xuICB1cHNlcnQoZXh0ZXJuYWxJZEZpZWxkTmFtZTogc3RyaW5nLCBzT2JqZWN0czogUmVjb3JkIHwgUmVjb3JkW10pIHtcbiAgICBjb25zdCBzY2hlbWEgPSBBcnJheS5pc0FycmF5KHNPYmplY3RzKVxuICAgICAgPyBbQXBpU2NoZW1hcy5VcHNlcnRSZXN1bHRdXG4gICAgICA6IEFwaVNjaGVtYXMuVXBzZXJ0UmVzdWx0O1xuICAgIGNvbnN0IGFyZ3MgPSB7XG4gICAgICAnQHhtbG5zJzogJ3VybjpwYXJ0bmVyLnNvYXAuc2ZvcmNlLmNvbScsXG4gICAgICAnQHhtbG5zOm5zMSc6ICdzb2JqZWN0LnBhcnRuZXIuc29hcC5zZm9yY2UuY29tJyxcbiAgICAgICduczE6ZXh0ZXJuYWxJREZpZWxkTmFtZSc6IGV4dGVybmFsSWRGaWVsZE5hbWUsXG4gICAgICAnbnMxOnNPYmplY3RzJzogdG9Tb2FwUmVjb3JkKHNPYmplY3RzKSxcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLl9pbnZva2UoJ3Vwc2VydCcsIGFyZ3MsIHNjaGVtYSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlcyBvbmUgb3IgbW9yZSByZWNvcmRzIGZyb20geW91ciBvcmdhbml6YXRpb27igJlzIGRhdGFcbiAgICovXG4gIGRlbGV0ZShpZHM6IHN0cmluZyB8IHN0cmluZ1tdKTogUHJvbWlzZTxEZWxldGVSZXN1bHRbXT47XG4gIGRlbGV0ZShpZDogc3RyaW5nKTogUHJvbWlzZTxEZWxldGVSZXN1bHQ+O1xuICBkZWxldGUoaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSk6IFByb21pc2U8RGVsZXRlUmVzdWx0IHwgRGVsZXRlUmVzdWx0W10+O1xuICBkZWxldGUoaWRzOiBzdHJpbmcgfCBzdHJpbmdbXSkge1xuICAgIGNvbnN0IHNjaGVtYSA9IEFycmF5LmlzQXJyYXkoaWRzKVxuICAgICAgPyBbQXBpU2NoZW1hcy5EZWxldGVSZXN1bHRdXG4gICAgICA6IEFwaVNjaGVtYXMuRGVsZXRlUmVzdWx0O1xuICAgIGNvbnN0IGFyZ3MgPSB7XG4gICAgICAnQHhtbG5zJzogJ3VybjpwYXJ0bmVyLnNvYXAuc2ZvcmNlLmNvbScsXG4gICAgICAnQHhtbG5zOm5zMSc6ICdzb2JqZWN0LnBhcnRuZXIuc29hcC5zZm9yY2UuY29tJyxcbiAgICAgICduczE6aWRzJzogaWRzLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuX2ludm9rZSgnZGVsZXRlJywgYXJncywgc2NoZW1hKTtcbiAgfVxufVxuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbi8qXG4gKiBSZWdpc3RlciBob29rIGluIGNvbm5lY3Rpb24gaW5zdGFudGlhdGlvbiBmb3IgZHluYW1pY2FsbHkgYWRkaW5nIHRoaXMgQVBJIG1vZHVsZSBmZWF0dXJlc1xuICovXG5yZWdpc3Rlck1vZHVsZSgnc29hcCcsIChjb25uKSA9PiBuZXcgU29hcEFwaShjb25uKSk7XG5cbmV4cG9ydCBkZWZhdWx0IFNvYXBBcGk7XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBSUEsSUFBQUEsUUFBQSxHQUFBQyxPQUFBO0FBRUEsSUFBQUMsS0FBQSxHQUFBQyxzQkFBQSxDQUFBRixPQUFBO0FBRUEsSUFBQUcsT0FBQSxHQUFBSCxPQUFBO0FBY3VCLFNBQUFJLFFBQUFDLE1BQUEsRUFBQUMsY0FBQSxRQUFBQyxJQUFBLEdBQUFDLGFBQUEsQ0FBQUgsTUFBQSxPQUFBSSw2QkFBQSxRQUFBQyxPQUFBLEdBQUFELDZCQUFBLENBQUFKLE1BQUEsT0FBQUMsY0FBQSxFQUFBSSxPQUFBLEdBQUFDLHdCQUFBLENBQUFELE9BQUEsRUFBQUUsSUFBQSxDQUFBRixPQUFBLFlBQUFHLEdBQUEsV0FBQUMsZ0NBQUEsQ0FBQVQsTUFBQSxFQUFBUSxHQUFBLEVBQUFFLFVBQUEsTUFBQVIsSUFBQSxDQUFBUyxJQUFBLENBQUFDLEtBQUEsQ0FBQVYsSUFBQSxFQUFBRyxPQUFBLFlBQUFILElBQUE7QUFBQSxTQUFBVyxjQUFBQyxNQUFBLGFBQUFDLENBQUEsTUFBQUEsQ0FBQSxHQUFBQyxTQUFBLENBQUFDLE1BQUEsRUFBQUYsQ0FBQSxVQUFBRyxNQUFBLEdBQUFGLFNBQUEsQ0FBQUQsQ0FBQSxZQUFBQyxTQUFBLENBQUFELENBQUEsWUFBQUEsQ0FBQSxZQUFBSSxTQUFBLEVBQUFDLHdCQUFBLENBQUFELFNBQUEsR0FBQXBCLE9BQUEsQ0FBQXNC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