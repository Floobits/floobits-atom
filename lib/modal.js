// var React = require('react-atom-fork');
// var div = require('reactionary-atom-fork').div;
// var create_node = require("./react_wrapper").create_node;

// var Component = React.createClass({
//   displayName: 'Floobits React Wrapper',
//   render: function () {
//     return div("asdf", {className: "asdf"});
//   }
// });

module.exports = {
  showWithText: function (title, msg) {
    atom.confirm({
      message: "Floobits: " + title,
      detailedMessage: msg,
      buttons: ["OK"]
    });
  },
};
