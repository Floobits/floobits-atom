"use strict";

const _ = require("lodash");
const AtomRange = require("atom").Range;
const wrapper = require("./react_wrapper");

module.exports = {
  rangeFromEditor: function (editor) {
    const selections = editor.selections;

    if (selections.length <= 0) {
      return [0, 0];
    }

    return _.map(selections, function (selection) {
      const range = selection.getBufferRange();
      const start = editor.buffer.characterIndexForPosition(range.start);
      const end = editor.buffer.characterIndexForPosition(range.end);
      return [start, end];
    });
  },

  offsetToBufferRange: function (buffer, start, end) {
    if (!buffer) {
      return null;
    }
    if (!buffer.positionForCharacterIndex) {
      console.error("no buffer.positionForCharacterIndex()!");
      return null;
    }
    const startPoint = buffer.positionForCharacterIndex(start);
    const endPoint = buffer.positionForCharacterIndex(end);
    return new AtomRange(startPoint, endPoint);
  },
  addRightPanel: function (name, view, styles) {
    const DOMNode = wrapper.create_node(name, view, styles);
    const pane = atom.workspace.addRightPanel({item: DOMNode});
    DOMNode.onDestroy(pane);
    return pane;
  },
  addModalPanel: function (element_name, view) {
    const DOMNode = wrapper.create_node(element_name, view, {width: "100%", height: "100%", overflow: "auto"});
    const pane = atom.workspace.addModalPanel({item: DOMNode});
    DOMNode.onDestroy(pane);
  }
};
