"use strict";

var _ = require("lodash");

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
  if (_.isFunction(opt_event)) {
    this.all_[++this.count] = listener ? opt_event.bind(listener) : opt_event;
    return this.count;
  }

  if (!_.has(this.on_, opt_event)) {
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

  args = _.toArray(arguments);

  _.each(this.all_, (l) => {
    l.apply(null, args);
  });

  args.shift();
  _.each((this.on_[event] || {}), (l) => {
    l.apply(null, args);
  });
};

Emitter.prototype.emitAsync = function (cb, event, args) {
  var events = this.on_[event] || {}, async = _.size(events) + _.size(this.all_);

  args = [args].concat(function popAsync() {
    if (async === 0) {
      throw new Error("cb fired more than once");
    }
    async -= 1;
    if (async === 0) {
      return cb && cb();
    }
  });

  _.each(this.all_, (l) => {
    l.apply(null, args);
  });

  _.each(events, (l) => {
    l.apply(null, args);
  });
};

/**
 * @param {string} event
 * @param {number} id
 */
Emitter.prototype.off = function (opt_event_or_id) {
  if (_.isNumber(opt_event_or_id)) {
    delete this.all_[opt_event_or_id];
    // TODO: I don't think this does what it's supposed to do --ggreer
    _.each(this.on_, function (events) {
      delete events[opt_event_or_id];
    });
    return;
  }
  if (_.isString(opt_event_or_id)) {
    delete this.on_[opt_event_or_id];
    return;
  }
  if (_.isUndefined(opt_event_or_id)) {
    this.all_ = {};
    this.on_ = {};
    return;
  }
  throw new Error("WTF is " + opt_event_or_id + " ?");
};


module.exports = Emitter;
