"use strict";
"use babel";

const _ = require("lodash");
const request = require("request");
const floorc = require("./floorc");
const utils = require("../utils");

const USER_AGENT = `Floobits Plugin 0.0.1 Atom-${process.version} ${process.platform} node-${process.versions.node}`;

var ERRORS_SENT = 0;
var MAX_ERROR_REPORTS = 5;
var ERROR_COUNT = 0;

function api_request (host, path, data, method, cb, opts) {
  const creds = floorc.auth[host];
  const options = {
    headers: {
      "Accept": "application/json",
      "User-Agent": USER_AGENT
    },
    strictSSL: false,
  };

  if (creds) {
    options.auth = {
      user: creds.username,
      pass: creds.secret,
      sendImmediately: true
    };
  }

  if (data) {
    options.json = data;
  }

  if (opts) {
    _.merge(options, opts);
  }

  const url = "https://" + host + path;

  try {
    request[method](url, options, function (err, res, body) {
      if (err) {
        return cb(err, res, body);
      }
      if (res.statusCode >= 300) {
        return cb(res.statusMessage || res.statusCode, res);
      }
      try {
        return cb(null, JSON.parse(body));
      } catch (e) {
        return cb(e, res, body);
      }
    });
  } catch (e) {
    return cb(e);
  }
}

module.exports = {
  get_credentials: function (host, username, password, cb) {
    return api_request(host, `/api/user/credentials/`, null, "get", cb, {
      auth: {
        user: username,
        pass: password
      }
    });
  },
  create_workspace: function (host, name, owner, perms, cb) {
    const path = `/api/workspace`;
    const post_data = {
      name: name,
      owner: owner,
      perms: perms
    };
    return api_request(host, path, post_data, "post", cb);
  },
  delete_workspace: function (host, owner, workspace, cb) {
    const path = `/api/workspace/${owner}/${workspace}`;
    return api_request(host, path, null, "DELETE", cb);
  },
  update_workspace: function (workspace_url, data, cb) {
    var result = utils.parse_url(workspace_url);
    var host = result.host;
    const path = `/api/workspace/${owner}/${workspace}`;
    return api_request(result, path, data, "put", cb);
  },
  get_workspace_by_url: function (url, cb) {
    var result = utils.parse_url(url);
    const path = `/api/workspace/${result.owner}/${result.workspace}`;
    return api_request(result.host, path, null, "get", cb);
  },
  get_workspace: function (host, owner, workspace, cb) {
    const path = `/api/workspace/${owner}/${workspace}`;
    return api_request(host, path, null, "get", cb);
  },
  get_workspaces: function (host, cb) {
    const path = `/api/workspaces/can/view`;
    return api_request(host, path, null, "get", cb);
  },
  get_orgs: function (host, cb) {
    const path = `/api/orgs`;
    return api_request(host, path, null, "get", cb);
  },
  get_orgs_can_admin: function (host, cb) {
    const path = `/api/orgs/can/admin`;
    return api_request(host, path, null, "get", cb);
  },
  send_error: function (description, error) {
    ERROR_COUNT += 1;
    var data = {
      jsondump: {
        error_count: ERROR_COUNT
      },
      message: {},
      dir: fl.base_path,
    };

    var stack = "";

    if (error) {
      stack = error.stack;
      description = description || error.message;
    }

    data.message = {
      description: description,
      stack: stack
    };

    console.log("Floobits plugin error! Sending exception report: ", data.message);
    if (ERRORS_SENT >= MAX_ERROR_REPORTS) {
      console.warn("Already sent ", ERRORS_SENT, " errors this session. Not sending any more.\n", description, exception, stack);
      return;
    }

    var floourl = require("../floobits").floourl;

    var host;

    if (floourl) {
      data.owner = floourl.owner;
      data.workspace = floourl.workspace;
      data.username = "????";
      host = floourl.host;
    } else {
      host = "floobits.com";
    }

    try {
      let api_url = `https://${host}/api/log`;
      ERRORS_SENT += 1;
      api_request(host, api_url, data, "get", function (err) {
        if (err) {
          console.error(err);
        }
      });

    } catch (e) {
      console.error(e);
    }
  }
};



// function send_errors (f) {
//     @wraps(f)
//     def wrapped(*args, **kwargs):
//         try:
//   return f(*args, **kwargs)

//         except Exception as e:
//   send_error(None, e)
//   raise
//     return wrapped
//   }
