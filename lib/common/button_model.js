"use strict";

const flux = require("flukes");

const ButtonModel = flux.createModel({
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

const Buttons = flux.createCollection({
  modelName: "Buttons",
  model: ButtonModel,
});


module.exports = {
  Button: ButtonModel,
  Buttons: Buttons,
};
