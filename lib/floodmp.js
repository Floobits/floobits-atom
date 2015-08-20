"use strict";

const util = require("util");

const dmp = require("dmp");

function FlooDMP() {
  dmp.call(this);
}

util.inherits(FlooDMP, dmp);

FlooDMP.prototype.patch_apply = function (patches, text) {
  if (patches.length === 0) {
    return [text, []];
  }

  // Deep copy the patches so that no changes are made to originals.
  patches = this.patch_deepCopy(patches);

  let nullPadding = this.patch_addPadding(patches);
  text = nullPadding + text + nullPadding;

  this.patch_splitMax(patches);
  // delta keeps track of the offset between the expected and actual location
  // of the previous patch. If there are patches expected at positions 10 and
  // 20, but the first patch was found at 12, delta is 2 and the second patch
  // has an effective expected position of 22.
  let delta = 0;
  let results = [];
  let positions = [];
  for (let x = 0; x < patches.length; x++) {
    let position = [3, 0, ""];
    let expected_loc = patches[x].start2 + delta;
    let text1 = this.diff_text1(patches[x].diffs);
    let start_loc;
    let replacement_str;
    let end_loc = -1;
    if (text1.length > this.Match_MaxBits) {
      // patch_splitMax will only provide an oversized pattern in the case of
      // a monster delete.
      start_loc = this.match_main(text, text1.substring(0, this.Match_MaxBits),
                                  expected_loc);
      if (start_loc !== -1) {
        end_loc = this.match_main(text,
            text1.substring(text1.length - this.Match_MaxBits),
            expected_loc + text1.length - this.Match_MaxBits);
        if (end_loc === -1 || start_loc >= end_loc) {
          // Can't find valid trailing context. Drop this patch.
          start_loc = -1;
        }
      }
    } else {
      start_loc = this.match_main(text, text1, expected_loc);
    }
    if (start_loc === -1) {
      // No match found. :(
      results[x] = false;
      // Subtract the delta for this failed patch from subsequent patches.
      delta -= patches[x].length2 - patches[x].length1;
    } else {
      // Found a match. :)
      results[x] = true;
      delta = start_loc - expected_loc;
      let text2;
      if (end_loc === -1) {
        text2 = text.substring(start_loc, start_loc + text1.length);
      } else {
        text2 = text.substring(start_loc, end_loc + this.Match_MaxBits);
      }
      if (text1 === text2) {
        // Perfect match, just shove the replacement text in.
        replacement_str = this.diff_text2(patches[x].diffs);
        text = text.substring(0, start_loc) +
               replacement_str +
               text.substring(start_loc + text1.length);
        position = [start_loc, text1.length, replacement_str];
      } else {
        // Imperfect match. Run a diff to get a framework of equivalent
        // indices.
        let diffs = this.diff_main(text1, text2, false);
        if (text1.length > this.Match_MaxBits &&
            this.diff_levenshtein(diffs) / text1.length >
            this.Patch_DeleteThreshold) {
          // The end points match, but the content is unacceptably bad.
          results[x] = false;
        } else {
          this.diff_cleanupSemanticLossless(diffs);
          let index1 = 0;
          let index2;
          let delete_len = 0;
          let inserted_text = "";
          for (let y = 0; y < patches[x].diffs.length; y++) {
            let mod = patches[x].diffs[y];
            if (mod[0] !== dmp.DIFF_EQUAL) {
              index2 = this.diff_xIndex(diffs, index1);
            }
            if (mod[0] === dmp.DIFF_INSERT) { // Insertion
              text = text.substring(0, start_loc + index2) + mod[1] +
                     text.substring(start_loc + index2);
              inserted_text += mod[1];
            } else if (mod[0] === dmp.DIFF_DELETE) { // Deletion
              let diff_index = this.diff_xIndex(diffs,
                         index1 + mod[1].length);
              // self.diff_xIndex(diffs, index1 + len(data));
              text = text.substring(0, start_loc + index2) +
                     text.substring(start_loc + diff_index);
              delete_len += (diff_index - index2);
            }
            if (mod[0] !== dmp.DIFF_DELETE) {
              index1 += mod[1].length;
            }
          }
          position = [start_loc, delete_len, inserted_text];
        }
      }
    }
    let np_len = nullPadding.length;
    if (position[0] < np_len){
      position[1] -= np_len - position[0];
      position[2] = position[2].substring(np_len - position[0]);
      position[0] = 0;
    }else{
      position[0] -= np_len;
    }

    let too_close = (position[0] + position[2].length) - (text.length - 2 * np_len);
    if (too_close > 0) {
      position[2] = position[2].substring(0, position[2].length - too_close);
    }
    positions.push(position);
  }
  // Strip the padding off.
  text = text.substring(nullPadding.length, text.length - nullPadding.length);
  return [text, results, positions];
};

exports.FlooDMP = FlooDMP;
