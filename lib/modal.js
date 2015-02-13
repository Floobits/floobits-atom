var React = require('react-atom-fork');
var div = require('reactionary-atom-fork').div;
var create_node = require("./react_wrapper").create_node;

var Component = React.createClass({
  displayName: 'Floobits React Wrapper',
  render: function () {
    return div("asdf", {className: "asdf"});
  }
});

module.exports = create_node("asdf", Component(), ".floobits {color: red}");
