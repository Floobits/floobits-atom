"use strict";
const atomUtils = require("./atom_utils");

module.exports = {
  showView: function (view) {
    atomUtils.addModalPanel("handle-request-perm", view);
  },
  showWithText: function (title, msg) {
    atom.confirm({
      message: "Floobits: " + title,
      detailedMessage: msg,
      buttons: ["OK"]
    });
  },
};
