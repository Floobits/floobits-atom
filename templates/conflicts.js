/** @jsx React.DOM */
"use 6to5"
var _ = require("lodash");
var path = require("path");
var React = require('react-atom-fork');
var floop = require("../common/floop");
$ = require('atom-space-pen-views').$;
var utils = require("../utils");

module.exports = React.createClass({
  treeize_: function (obj) {
    var node, tree;
    node = tree = {};
    _.each(obj, function (p) {
      node = tree;
      p.split(path.sep).forEach(function (p) {
        if (p in node) {
          node = node[p];
          return;
        }
        node[p] = {};
        node = node[p]
      });
    });
    return tree;
  },
  getInitialState: function () {
    return {
      enabled: true,
      clicked: "",
    }
  },
  componentDidMount: function () {
    var local = this.refs.local;
    $(local.getDOMNode()).focus();
  },
  onClick: function (id) {
    console.log(id);
  },
  render_: function (name, items) {
    return (
      <div className="">
        <h3>{name}</h3>
        <ol>
          {
            _.map(items, function(b, id) {
              var path = b.path;
              return (<li className="" onClick={this.onClick.bind(this, id, path)}>{path}</li>);
            }, this)
          }
        </ol>
      </div>
    )
  },
  remote_: function () {
    this.setState({enabled: false});
    _.each(this.props.different, function (b, id) {
      floop.send_set_buf({
        id: id,
        buf: b.txt,
        md5: b.md5,
        // TODO: get encoding
        // encoding: "utf8",
      });
    });
    // ST3 behavior 
    // self.send({'name': 'saved', 'id': existing_buf['id']})

    _.each(this.props.missing, function (b, id) {
      floop.send_delete_buf({id: id});
    });

    _.each(this.props.newFiles, function (b, rel) {
      fs.readFile(b.path, function (err, data) {
        if (err) {
          console.log(err);
          return;
        }
        var encoding = utils.is_binary(data, data.length) ? "base64" : "utf8";

        floop.send_create_buf({
          path: rel,
          buf: encoding === "utf8" ? data.toString("utf8") : data.toString("base64"),
          encoding: encoding,
          md5: utils.md5(data),
        });
      });
    });
  },
  local_: function () {
    var fetch = _.merge(this.props.missing, this.props.different);
    this.setState({enabled: false});
    _.each(fetch, function (b, id) {
      floop.send_get_buf(id);
    });
  },
  cancel_: function () {
    this.setState({enabled: false});
    require("../floobits").leave_workspace();
  },
  render: function() {
    var missing = this.render_("missing", this.props.missing);
    var different = this.render_("different", this.props.different);
    var newFiles = this.render_("newFiles", this.props.newFiles);

    return (
      <div className="native-key-bindings" style={{overflow: "auto"}}>
        <h1>Your local files are different from the workspace.</h1>
        <button disabled={!this.state.enabled} onClick={this.remote_}>Overwrite Remote Files</button>
        <button ref="local" disabled={!this.state.enabled} onClick={this.local_}>Overwrite Local Files</button>
        <button disabled={!this.state.enabled} onClick={this.cancel_}>Cancel</button>

        {missing}
        {different}
        {newFiles}
      </div> 
    );
  }
});