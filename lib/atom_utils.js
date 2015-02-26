var _ = require("lodash");

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
  }
};