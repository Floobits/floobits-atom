/** @jsx React.DOM */

"use strict";

const _ = require("lodash");
const React = require("react-atom-fork");
const $ = require('atom-space-pen-views').$;
const TYPES = ["admin_room", "edit_room", "request_perms", "view_room"];

module.exports = React.createClass({
  permissions: null,
  getInitialState: function () {
    this.owner = this.props.floourl.owner;
    this.workspace = this.props.floourl.workspace;
    return {
      secret: null,
      is_org: false,
      usernames: [],
      perms: [],
      selectedIndex: -1,
      newUser: null,
      anonUser: null,
      error: null,
    };
  },
  componentWillMount: function () {
    this.loadData();
  },
  loadData: function () {
    this.ajax({
      type: "GET",
      url: this.props.floourl.toAPIString(),
      success: function (data) {
        var anonUser, perms = [];

        if (!this.isMounted()) {
          return;
        }

        _.map(data.perms, function (permissions, username) {
          var user = {
            id: username,
            permissions,
          };
          if (username === "AnonymousUser") {
            anonUser = user;
          } else {
            perms.push(user);
          }
        });
        if (this.refs.editAutocomplete) {
          this.refs.editAutocomplete.getDOMNode().value = "";
          this.refs.new_admin_room.getDOMNode().checked = false;
          this.refs.new_edit_room.getDOMNode().checked = false;
          this.refs.new_request_perms.getDOMNode().checked = false;
          this.refs.new_view_room.getDOMNode().checked = false;
        }
        this.setState({
          selectedIndex: -1,
          usernames: [],
          newUser: null,
          secret: data.secret,
          perms,
          is_org: data.is_org,
          anonUser,
          error: null,
        });
      }
    });
  },
  componentDidUpdate: function () {
    const selected = this.refs.selected;
    if (!selected) {
      return;
    }
    let el = selected.getDOMNode();
    if (_.isFunction(el.scrollIntoViewIfNeeded)) {
      el.scrollIntoViewIfNeeded();
    } else {
      el.scrollIntoView();
    }
  },
  close: function () {
    this.getDOMNode().parentNode.destroy();
  },
  save: function () {
    const data = {
      perms: {},
      secret: this.refs.isSecret.getDOMNode().checked,
      name: this.workspace,
      owner: this.owner,
    };
    this.state.perms.forEach((user, index) => {
      data.perms[user.id] = TYPES.filter((type) => {
        return this.refs["" + index + type].getDOMNode().checked;
      });
    });
    if (this.state.newUser) {
      data.perms[this.state.newUser.user] = TYPES.filter((type) => {
        return this.refs["new_" + type].getDOMNode().checked;
      });
    }
    data.perms.AnonymousUser = TYPES.filter((type) => {
      if (type === "admin_room") {
        return false;
      }
      return this.refs["anon_" + type].getDOMNode().checked;
    });
    this.ajax({
      type: "put",
      url: this.props.floourl.toAPIString(),
      contentType: "application/json",
      data: JSON.stringify(data),
      success: () => {
        console.log("success saving permission data", arguments);
        // TODO: this is wasteful. it does another XHR. We could just look at the success response here
        this.loadData();
        this.close();
      },
      error: (e) => {
        this.setState({
          errors: e.statusText || "Unknown error. :(",
        });
      }
    });
  },
  addSelectedUserFromLi_: function (index) {
    this.addSelectedUser_(index);
  },
  addSelectedUser: function () {
    if (this.state.selectedIndex < 0) {
      this.setState({usernames: []});
      return;
    }
    this.addSelectedUser_(this.state.selectedIndex);
  },
  addSelectedUser_: function (index) {
    var newUser;
    newUser = this.state.usernames[index];
    if (!newUser) {
      this.setState({newUser: null, usernames: [], selectedIndex: -1});
      return;
    }
    this.refs.editAutocomplete.getDOMNode().value = newUser.user;
    this.setState({newUser, usernames: [], selectedIndex: -1});
    this.refs.new_admin_room.getDOMNode().focus();
  },
  preAutoComplete_: function (event) {
    var tab;
    tab = 9;
    if (event.keyCode === tab && !event.shiftKey) {
      event.preventDefault();
      return;
    }
  },
  autoComplete_: function (event) {
    var keyCode, down, up, tab, enter, selectedIndex;
    up = 38;
    down = 40;
    tab = 9;
    enter = 13;
    keyCode = event.keyCode;
    switch (keyCode) {
      case down:
        //move down or up if at the end
        selectedIndex = this.state.selectedIndex + 1;
        if (selectedIndex >= this.state.usernames.length) {
          selectedIndex = 0;
        }
        this.setState({selectedIndex});
        break;
      case up:
        selectedIndex = this.state.selectedIndex - 1;
        if (selectedIndex < 0) {
          selectedIndex = this.state.usernames.length - 1;
        }
        this.setState({selectedIndex});
        break;
      case enter:
      case tab:
        this.addSelectedUser();
        break;
      default:
        this.fetchAutoComplete_();
        break;
    }
  },
  ajax: function (data) {
    const auth = this.props.auth;
    data.username = auth.username || auth.api_key;
    data.password = auth.secret;
    $.ajax(data);
  },
  fetchAutoComplete_: function () {
    var value, input = this.refs.editAutocomplete.getDOMNode();
    value = input.value || "";
    value = value.trim();
    if (!value) {
      this.setState({newUser: null, usernames: [], selectedIndex: -1});
      input.value = "";
      return;
    }
    const url = `https://${this.props.floourl.host}/api/autocomplete/json_username/${value}`;
    const that = this;
    this.ajax({
      type: "GET",
      url: url,
      success: function (users) {
        if (!(users && users.length && that.isMounted())) {
          return;
        }
        that.setState({"usernames": users, selectedIndex: 0});
      },
      error: function () {
        if (!that.isMounted()) {
          return;
        }
        that.setState({"usernames": [], selectedIndex: -1});
      }
    });
  },
  handlePermissionChange_: function (type, index) {
    var checked, refKey, permIndex = TYPES.indexOf(type);
    refKey = "" + index + type;
    checked = this.refs[refKey].getDOMNode().checked;
    TYPES.forEach(function (t, i) {
      if (index === "anon_" && t === "admin_room") {
        return;
      }
      refKey = "" + index + t;
      if (checked && i > permIndex) {
        this.refs[refKey].getDOMNode().checked = true;
      } else if (!checked && i < permIndex) {
        this.refs[refKey].getDOMNode().checked = false;
      }
    }, this);
  },
  getInput: function (index, user, type) {
    var labels = {
      "admin_room": "Admin",
      "edit_room": "Edit",
      "request_perms": "Request permissions",
      "view_room": "View",
    };
    return (
      <td key={index + type}>
        <label>{labels[type]} <input type="checkbox" className="perm-cb native-key-bindings"
          onChange={this.handlePermissionChange_.bind(this, type, index)}
          defaultChecked={user && user.permissions.indexOf(type) !== -1}
          ref={index + type} />
        </label>
      </td>
    );
  },
  render: function () {
    return this.renderBody();
  },
  /**
   * @param {Object} event
   * @private
   */
  renderBody: function () {
    if (this.state.secret === null) {
      return (<p>Loading</p>);
    }
    const anonUser = this.state.anonUser;
    const users = this.state.perms.map(function (user, index) {
      var inputs = TYPES.map(function (type) {
        return this.getInput(index, user, type);
      }, this);
      return (
        <tr key={user.id}>
          <td className="user-with-perms">{user.id}</td>
          {inputs}
        </tr>
      );
    }, this);
    const usernames = this.state.usernames.map(function (user, index) {
      return (
        <li
          key={user.user + index}
          onClick={this.addSelectedUserFromLi_.bind(this, index)}
          ref={this.state.selectedIndex === index ? "selected" : ("notSelected" + index)}
          className={this.state.selectedIndex === index ? "selected" : ""}>
            <img style={{height: 30, width: 30}}
              src={"https://secure.gravatar.com/avatar/" + user.email_hash} />
            <span className="username">{user.user}</span>
        </li>
      );
    }, this);
    const newInputs = TYPES.map(this.getInput.bind(this, "new_", null));
    const anonInputs = TYPES.filter(function (type) { return type !== "admin_room"; })
      .map(this.getInput.bind(this, "anon_", anonUser));

    const workspace = this.props.floourl.workspace;
    const owner = this.props.floourl.owner;
    return (
      <div id="edit-perms-content-wizard" className="workspace-wizard">
        <p className="wizard-section no-content"><strong>Edit Permissions for {owner}/{workspace}</strong></p>
        <div id="secret-content" className="wizard-section">
          <label>This workspace is secret <input type="checkbox" id="secret-workspace"
            ref="isSecret"
            defaultChecked={this.state.secret}/></label>
            <br/>
            <small>Secret workspaces are unlisted. They count towards private workspaces.</small>
        </div>
        {anonUser &&
        <div id="all-perms-content" className="wizard-section">
          Everyone can:
          <div className="everyone-can">
            <table>
              <tr>
              {anonInputs}
              </tr>
            </table>
          </div>
        </div>
        }
        <div id="user-perms-content" className="wizard-section">
          <table>
            <thead>
              <tr>
               <th>User</th>
               <th colSpan="4">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {users}
              <tr>
                <td><input type="text" ref="editAutocomplete" className="edit-autocomplete autocomplete native-key-bindings"
                  onKeyDown={this.preAutoComplete_}
                  onKeyUp={this.autoComplete_} />
                  <div className="autocomplete-content" style={{display: (usernames.length ? "block" : "none")}}>
                    <div ref="autoCompleteResults"
                      className="edit-perms-autocomplete-results">
                      <ul className="autocomplete_results">{usernames}</ul>
                      </div>
                  </div>
                </td>
                {newInputs}
              </tr>
            </tbody>
          </table>
        </div>

        {this.state.is_org && (<div>
          <div>
            <a href={"/" + this.owner + "/members"}>Add a member to your organization.</a>
          </div>
          <div>
            <a href={"/" + this.owner + "/invite"}>Invite users to your organization.</a>
          </div>
        </div>)}
        {this.state.error && (<div className="alert alert-danger">
          Error saving permissions: {this.state.errors}
        </div>)}
        {this.renderFooter()}
      </div>
    );
  },
  renderFooter: function () {
    return (
      <div>
        <button className="btn btn-default btn-danger" onClick={this.save}>Save</button>
        <button className="btn btn-default" onClick={this.close}>Close</button>
      </div>
    );
  }
});
