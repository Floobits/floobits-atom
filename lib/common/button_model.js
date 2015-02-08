/* @flow weak */
/*global _, React */
"use strict";

var ButtonModel,
  Buttons,
  flux = require("flukes");

ButtonModel = flux.createModel({
  modelName: "Button",
  fieldTypes: {
    name: flux.FieldTypes.string,
    action: flux.FieldTypes.func,
    classNames: flux.FieldTypes.arrayOf(flux.FieldTypes.string),
  },
  getDefaultFields: function () {
    return {
      action: function () { return; },
      classNames: [],
    };
  }
});

Buttons = flux.createCollection({
  modelName: "Buttons",
  model: ButtonModel,
});


module.exports = {
  Button: ButtonModel,
  Buttons: Buttons,
};
