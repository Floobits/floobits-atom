
var utils = require("../utils");

/**
 * @constructor
 */
function Emitter () {
  /**
   * @type {number}
   * @private
   */
  this.count = 0;
  /**
   * @type {Object}
   * @private
   */
  this.on_ = {};
  /**
   * @type {Object}
   * @private
   */
  this.all_ = {};
}

/**
 * @param {string} opt_event
 * @param {Function} listener
 * @param {Object=} opt_thisArg
 */
Emitter.prototype.on = function (opt_event, listener, opt_thisArg) {
  if (utils.isFunction(opt_event)) {
    this.all_[++this.count] = listener ? opt_event.bind(listener) : opt_event;
    return this.count;
  }

  if (!utils.has(this.on_, opt_event)) {
    this.on_[opt_event] = {};
  }
  this.on_[opt_event][++this.count] = opt_thisArg ? listener.bind(opt_thisArg) : listener;
  return this.count;
};

/**
 * @param {string} event
 */
Emitter.prototype.emit = function (event) {
  var args;

  args = utils.toArray(arguments);

  utils.each(this.all_, function (l) {
    l.apply(null, args);
  }, this);

  args.shift();
  utils.each((this.on_[event] || {}), function (l, k) {
    l.apply(null, args);
  }, this);
};

Emitter.prototype.emitAsync = function (cb, event, args) {
  var events = this.on_[event] || {}, async = utils.size(events) + utils.size(this.all_);

  args = [args].concat(function popAsync() {
    if (async === 0) {
      throw new Error("cb fired more than once");
    }
    async -= 1;
    if (async === 0) {
      return cb && cb();
    }
  });

  utils.each(this.all_, function (l) {
    l.apply(null, args);
  }, this);

  utils.each(events, function (l, k) {
    l.apply(null, args);
  }, this);
};

/**
 * @param {string} event
 * @param {number} id
 */
Emitter.prototype.off = function (opt_event_or_id) {
  if (utils.isNumber(opt_event_or_id)) {
    delete this.all_[opt_event_or_id];
    utils.each(this.on_, function(events, event) {
      delete events[opt_event_or_id];
    });
    return;
  }
  if (utils.isString(opt_event_or_id)) {
    delete this.on_[opt_event_or_id];
    return;
  }
  if (utils.isUndefined(opt_event_or_id)) {
    this.all_ = {};
    this.on_ = {};
    return;
  }
  throw new Error("WTF is " + opt_event_or_id + " ?");
};


module.exports = Emitter;
