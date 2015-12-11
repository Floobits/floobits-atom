/** @jsx React.DOM */
/*global fl */
"use strict";

const _ = require("lodash");
const path = require("path");
const React = require('react-atom-fork');
const floop = require("../common/floop");
const fs = require("fs");
const $ = require('atom-space-pen-views').$;
const utils = require("../utils");
const flux = require("flukes");

module.exports = React.createClass({
  mixins: [flux.createAutoBinder(['msgs'])],
  render: function () {
    const msgs = this.props.msgs.map(function (msg) {
      return (
        <div>
          [{msg.time}] {msg.username}: {msg.data}
        </div>);
    });
    return (
      <div className="native-key-bindings" style={{overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}} >
        hello
        {msgs}
      </div>
    );
  }
});
