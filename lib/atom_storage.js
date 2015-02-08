"use strict";

var _ = require("lodash"),
  utils = require("./utils"),
  AtomStorage;

function AtomStorage () {
  this.model = null;
}

AtomStorage.prototype.supported = function() {
  try {
    return 'atom' in self && self.atom !== null && atom.config;
  } catch (e) {
    return false;
  }
};

AtomStorage.prototype.getKey = function (namespace, model, id) {
  return "floobits." + model.id || id;

  // return "floobits::" + (namespace || settings.namespace) + "::" + model.modelName + "::" + (id || model.id);
};

AtomStorage.prototype.save = function (namespace, model, id, cb) {
  var key = this.getKey(namespace, model, id);

  try {
    AtomStorage[key] = JSON.stringify(model.valueOf());
  } catch (e) {
    if (utils.isFunction(cb)) {
      cb(e);
      return e;
    }
  }
};

AtomStorage.prototype.load = function (namespace, model, id, cb) {
  var cereal, data = {}, key = this.getKey(namespace, model, id);


  if (!cb) {
    cb = function () {};
  }
  if (!model) {
    return cb(new Error("Need a model instance"));  
  }

  this.model = model;

  cereal = atom.config.get("floobits");

  _.each(cereal, function (value, key) {
    if (!_.has(model.schema, key)) {
      return;
    }
    data[key] = value;
  });
  // if (!utils.isFinite(model.id) && !(model.id && model.id.length)) {
  //   model = new model(data);
  //   cb(null, model);
  //   return model;
  // }
  model.set(data);
  cb(null, model);
  return model;
};

module.exports = AtomStorage;
