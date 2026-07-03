"use strict";

var _Object$defineProperty = require("@babel/runtime-corejs3/core-js-stable/object/define-property");
_Object$defineProperty(exports, "__esModule", {
  value: true
});
exports.isObject = isObject;
exports.isMapObject = isMapObject;
exports.isFunction = isFunction;
exports.isNumber = isNumber;
exports.isPromiseLike = isPromiseLike;
exports.identityFunc = identityFunc;
exports.emptyFunc = emptyFunc;
/**
 *
 */
function isObject(v) {
  const t = typeof v;
  return v != null && (t == 'object' || t == 'function');
}

/**
 *
 */
function isMapObject(v) {
  const t = typeof v;
  return v != null && t == 'object';
}

/**
 *
 */
function isFunction(v) {
  return typeof v == 'function';
}

/**
 *
 */
function isNumber(v) {
  return typeof v == 'number';
}

/**
 * Detect whether the value has CommonJS Promise/A+ interface or not
 */
function isPromiseLike(v) {
  return isObject(v) && isFunction(v.then);
}

/**
 *
 */
function identityFunc(a) {
  return a;
}

/**
 *
 */
function emptyFunc() {}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJpc09iamVjdCIsInYiLCJ0IiwiaXNNYXBPYmplY3QiLCJpc0Z1bmN0aW9uIiwiaXNOdW1iZXIiLCJpc1Byb21pc2VMaWtlIiwidGhlbiIsImlkZW50aXR5RnVuYyIsImEiLCJlbXB0eUZ1bmMiXSwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbC9mdW5jdGlvbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc09iamVjdCh2OiBhbnkpOiB2IGlzIG9iamVjdCB7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdjtcbiAgcmV0dXJuIHYgIT0gbnVsbCAmJiAodCA9PSAnb2JqZWN0JyB8fCB0ID09ICdmdW5jdGlvbicpO1xufVxuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc01hcE9iamVjdCh2OiBhbnkpOiB2IGlzIHsgW25hbWU6IHN0cmluZ106IHVua25vd24gfSB7XG4gIGNvbnN0IHQgPSB0eXBlb2YgdjtcbiAgcmV0dXJuIHYgIT0gbnVsbCAmJiB0ID09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Z1bmN0aW9uKHY6IGFueSk6IHYgaXMgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnkge1xuICByZXR1cm4gdHlwZW9mIHYgPT0gJ2Z1bmN0aW9uJztcbn1cblxuLyoqXG4gKlxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOdW1iZXIodjogYW55KTogdiBpcyBudW1iZXIge1xuICByZXR1cm4gdHlwZW9mIHYgPT0gJ251bWJlcic7XG59XG5cbi8qKlxuICogRGV0ZWN0IHdoZXRoZXIgdGhlIHZhbHVlIGhhcyBDb21tb25KUyBQcm9taXNlL0ErIGludGVyZmFjZSBvciBub3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUHJvbWlzZUxpa2UodjogYW55KTogdiBpcyB7IHRoZW46IEZ1bmN0aW9uIH0ge1xuICByZXR1cm4gaXNPYmplY3QodikgJiYgaXNGdW5jdGlvbigodiBhcyBhbnkpLnRoZW4pO1xufVxuXG4vKipcbiAqXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpZGVudGl0eUZ1bmM8VD4oYTogVCkge1xuICByZXR1cm4gYTtcbn1cblxuLyoqXG4gKlxuICovXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlGdW5jKCkge31cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNPLFNBQVNBLFFBQVFBLENBQUNDLENBQU0sRUFBZTtFQUM1QyxNQUFNQyxDQUFDLEdBQUcsT0FBT0QsQ0FBQztFQUNsQixPQUFPQSxDQUFDLElBQUksSUFBSSxLQUFLQyxDQUFDLElBQUksUUFBUSxJQUFJQSxDQUFDLElBQUksVUFBVSxDQUFDO0FBQ3hEOztBQUVBO0FBQ0E7QUFDQTtBQUNPLFNBQVNDLFdBQVdBLENBQUNGLENBQU0sRUFBb0M7RUFDcEUsTUFBTUMsQ0FBQyxHQUFHLE9BQU9ELENBQUM7RUFDbEIsT0FBT0EsQ0FBQyxJQUFJLElBQUksSUFBSUMsQ0FBQyxJQUFJLFFBQVE7QUFDbkM7O0FBRUE7QUFDQTtBQUNBO0FBQ08sU0FBU0UsVUFBVUEsQ0FBQ0gsQ0FBTSxFQUFnQztFQUMvRCxPQUFPLE9BQU9BLENBQUMsSUFBSSxVQUFVO0FBQy9COztBQUVBO0FBQ0E7QUFDQTtBQUNPLFNBQVNJLFFBQVFBLENBQUNKLENBQU0sRUFBZTtFQUM1QyxPQUFPLE9BQU9BLENBQUMsSUFBSSxRQUFRO0FBQzdCOztBQUVBO0FBQ0E7QUFDQTtBQUNPLFNBQVNLLGFBQWFBLENBQUNMLENBQU0sRUFBMkI7RUFDN0QsT0FBT0QsUUFBUSxDQUFDQyxDQUFDLENBQUMsSUFBSUcsVUFBVSxDQUFFSCxDQUFDLENBQVNNLElBQUksQ0FBQztBQUNuRDs7QUFFQTtBQUNBO0FBQ0E7QUFDTyxTQUFTQyxZQUFZQSxDQUFJQyxDQUFJLEVBQUU7RUFDcEMsT0FBT0EsQ0FBQztBQUNWOztBQUVBO0FBQ0E7QUFDQTtBQUNPLFNBQVNDLFNBQVNBLENBQUEsRUFBRyxDQUFDIn0=