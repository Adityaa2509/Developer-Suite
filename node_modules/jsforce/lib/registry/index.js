"use strict";

var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
_Object$defineProperty(exports, "FileRegistry", {
  enumerable: true,
  get: function () {
    return _file.FileRegistry;
  }
});
_Object$defineProperty(exports, "SfdxRegistry", {
  enumerable: true,
  get: function () {
    return _sfdx.SfdxRegistry;
  }
});
_Object$defineProperty(exports, "EmptyRegistry", {
  enumerable: true,
  get: function () {
    return _empty.EmptyRegistry;
  }
});
exports.default = void 0;
var _file = require("./file");
var _sfdx = require("./sfdx");
var _empty = require("./empty");
let registry;
try {
  registry = process.env.JSFORCE_CONNECTION_REGISTRY === 'sfdx' ? new _sfdx.SfdxRegistry({}) : new _file.FileRegistry({});
} catch (e) {
  console.error(e);
  registry = new _empty.EmptyRegistry();
}
var _default = registry;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZmlsZSIsInJlcXVpcmUiLCJfc2ZkeCIsIl9lbXB0eSIsInJlZ2lzdHJ5IiwicHJvY2VzcyIsImVudiIsIkpTRk9SQ0VfQ09OTkVDVElPTl9SRUdJU1RSWSIsIlNmZHhSZWdpc3RyeSIsIkZpbGVSZWdpc3RyeSIsImUiLCJjb25zb2xlIiwiZXJyb3IiLCJFbXB0eVJlZ2lzdHJ5IiwiX2RlZmF1bHQiLCJleHBvcnRzIiwiZGVmYXVsdCJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZWdpc3RyeS9pbmRleC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyBGaWxlUmVnaXN0cnkgfSBmcm9tICcuL2ZpbGUnO1xuaW1wb3J0IHsgU2ZkeFJlZ2lzdHJ5IH0gZnJvbSAnLi9zZmR4JztcbmltcG9ydCB7IEVtcHR5UmVnaXN0cnkgfSBmcm9tICcuL2VtcHR5JztcblxubGV0IHJlZ2lzdHJ5OiBSZWdpc3RyeTtcbnRyeSB7XG4gIHJlZ2lzdHJ5ID1cbiAgICBwcm9jZXNzLmVudi5KU0ZPUkNFX0NPTk5FQ1RJT05fUkVHSVNUUlkgPT09ICdzZmR4J1xuICAgICAgPyBuZXcgU2ZkeFJlZ2lzdHJ5KHt9KVxuICAgICAgOiBuZXcgRmlsZVJlZ2lzdHJ5KHt9KTtcbn0gY2F0Y2ggKGUpIHtcbiAgY29uc29sZS5lcnJvcihlKTtcbiAgcmVnaXN0cnkgPSBuZXcgRW1wdHlSZWdpc3RyeSgpO1xufVxuXG5leHBvcnQgZGVmYXVsdCByZWdpc3RyeTtcbmV4cG9ydCB0eXBlIHsgUmVnaXN0cnkgfTtcbmV4cG9ydCB7IEZpbGVSZWdpc3RyeSwgU2ZkeFJlZ2lzdHJ5LCBFbXB0eVJlZ2lzdHJ5IH07XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSxJQUFBQSxLQUFBLEdBQUFDLE9BQUE7QUFDQSxJQUFBQyxLQUFBLEdBQUFELE9BQUE7QUFDQSxJQUFBRSxNQUFBLEdBQUFGLE9BQUE7QUFFQSxJQUFJRyxRQUFrQjtBQUN0QixJQUFJO0VBQ0ZBLFFBQVEsR0FDTkMsT0FBTyxDQUFDQyxHQUFHLENBQUNDLDJCQUEyQixLQUFLLE1BQU0sR0FDOUMsSUFBSUMsa0JBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUNwQixJQUFJQyxrQkFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzVCLENBQUMsQ0FBQyxPQUFPQyxDQUFDLEVBQUU7RUFDVkMsT0FBTyxDQUFDQyxLQUFLLENBQUNGLENBQUMsQ0FBQztFQUNoQk4sUUFBUSxHQUFHLElBQUlTLG9CQUFhLENBQUMsQ0FBQztBQUNoQztBQUFDLElBQUFDLFFBQUEsR0FFY1YsUUFBUTtBQUFBVyxPQUFBLENBQUFDLE9BQUEsR0FBQUYsUUFBQSJ9