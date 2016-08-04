/** @jsx React.DOM */
/*global fl */
"use strict";
const fs = require("fs");
const path = require("path");

const _ = require("lodash");
const $ = require('atom-space-pen-views').$;
const React = require('react-atom-fork');

const floop = require("../common/floop");
const utils = require("../common/utils");

module.exports = React.createClass({
  treeize_: function (obj) {
    let node = {};
    let tree = {};
    _.each(obj, function (p) {
      node = tree;
      p.split(path.sep).forEach(function (p) {
        if (p in node) {
          node = node[p];
          return;
        }
        node[p] = {};
        node = node[p];
      });
    });
    return tree;
  },
  getInitialState: function () {
    return {
      enabled: true,
      clicked: "",
      totalFiles: _.size(this.props.different) + _.size(this.props.newFiles) + _.size(this.props.missing),
      missing: new Set(),
      different: new Set(),
      newFiles: new Set(),
    };
  },
  componentDidMount: function () {
    if (this.props.justUpload) {
      const upload = this.remote_;
      setTimeout(function () {
        upload();
      }, 0);
    }

    const local = this.refs.local;
    if (!local) {
      return;
    }
    $(local.getDOMNode()).focus();
  },
  onClick: function (id) {
    console.log(id);
  },
  remote_: function () {
    this.setState({enabled: false});
    _.each(this.props.different, (b, id) => {
      let encoding = b.encoding || "utf8";
      floop.send_set_buf({
        id, encoding,
        buf: b.txt.toString(encoding),
        md5: b.md5,
      }, null, (err) => {
        if (!err) {
          this.setState({different: this.state.different.add(id)});
          floop.send_saved({id: id});
        }
      });
    });

    _.each(this.props.missing, (b, id) => {
      floop.send_delete_buf({id}, null, () => {
        // TODO: check err
        this.setState({missing: this.state.missing.add(id)});
      });
    });

    _.each(this.props.newFiles, (b, rel) => {
      fs.readFile(b.path, (err, data) => {
        if (err) {
          console.log(err);
          return;
        }

        const encoding = utils.is_binary(data, data.length) ? "base64" : "utf8";
        floop.send_create_buf({
          path: rel,
          buf: data.toString(encoding),
          encoding: encoding,
          md5: utils.md5(data),
        }, null, () => {
          this.setState({newFiles: this.state.newFiles.add(rel)});
        });
      });
    });
    this.props.onHandledConflicts({});
  },
  local_: function () {
    this.setState({
      enabled: false,
      newFiles: new Set(_.keys(this.props.newFiles)),
    });
    _.each(this.props.missing, (b, id) => {
      floop.send_get_buf(id, () => this.setState({missing: this.state.missing.add(id)}));
    });
    _.each(this.props.different, (b, id) => {
      floop.send_get_buf(id, () => this.setState({different: this.state.different.add(id)}));
    });
    const toFetch = _.merge({}, this.props.missing, this.props.different);
    this.props.onHandledConflicts(toFetch);
  },
  cancel_: function () {
    this.setState({enabled: false});
    require("../floobits").leave_workspace();
  },
  render_: function (title, name) {
    const items = this.props[name];
    const completed = this.state[name];
    if (!_.size(items)) {
      return "";
    }
    return (
      <div>
        <h3>{title}</h3>
        <ol>
          {
            _.map(items, (b, id) => {
              const path = b.path;
              const checked = completed.has(id) ? "✓" : "";
              return (<li key={id} onClick={this.onClick.bind(this, id, path)}>{path} &nbsp;{checked}</li>);
            })
          }
        </ol>
      </div>
    );
  },
  render_progress: function () {
    if (this.state.enabled) {
      return false;
    }
    const state = this.state;
    const width = parseInt((state.different.size + state.newFiles.size + state.missing.size) / state.totalFiles * 100, 10);
    const progressWidth = `${width}%`;
    return (
      <div>
        <div className="fl-progress">
          <span className="fl-progress-text">{progressWidth}</span>
          <div className="fl-progress-bar" style={{width: progressWidth}} role="progressbar"></div>
        </div>
        <p className="alert alert-info" style={{marginBottom: 0, visibility: width === 100 ? "visible" : "hidden"}}>
          All done syncing files!
        </p>
      </div>
    );
  },
  render_created_workspace: function () {
    const newFiles = this.render_("Uploading:", "newFiles");
    const progress = this.render_progress();
    return (<div>
      <h1 className="native-key-bindings">Created {fl.floourl ? fl.floourl.toString() : "the workspace"}</h1>
      { progress }
      { newFiles }
    </div>);
  },
  render_conflicts: function () {
    const missing = this.render_("Missing", "missing");
    const different = this.render_("Different", "different");
    const newFiles = this.render_("New", "newFiles");
    const ignored = _.map(this.props.ignored, function (p) {
      return <li key={p}>{p}</li>;
    });

    const tooBig = _.map(this.props.tooBig, function (size, p) {
      return <li key={p}>{p} {utils.formatBytes(size)}</li>;
    });

    const state = this.state;
    const progress = this.render_progress();

    return (<div>
      <h1>Your local files are different from the workspace.</h1>
      <button className="btn btn-primary" disabled={!state.enabled} onClick={this.remote_}>Overwrite Remote Files</button>
      <button className="btn btn-primary" disabled={!state.enabled} onClick={this.local_} ref="local">Overwrite Local Files</button>
      <button className="btn btn-default" disabled={!state.enabled} onClick={this.cancel_}>Cancel</button>

      {progress}

      {missing}
      {different}
      {newFiles}
      {!this.props.ignored.length ? "" :
        <div className="">
          <h3>Ignored</h3>
          <ol>
            { ignored }
          </ol>
        </div>
      }
      {!tooBig.length ? "" :
        <div className="">
          <h3>Too Big</h3>
          <ol>
            { tooBig }
          </ol>
        </div>
      }
    </div>);
  },
  render: function () {
    const body = this.props.justUpload ? this.render_created_workspace() : this.render_conflicts();
    return (
      <div className="native-key-bindings" style={{overflow: "auto", border: 0, padding: 10, left: 0, top: 0, margin: 0, width: "100%", height: "100%"}} >
        {body}
      </div>
    );
  }
});
