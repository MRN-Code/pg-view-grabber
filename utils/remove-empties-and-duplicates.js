/* jshint node:true */

'use strict';

/**
 * Remove falsy and duplicate items from an array.
 *
 * @param  {array} items
 * @return {array}
 */
function removeEmptiesAndDuplicates(items) {
    return items.reduce(function(nonDuplicates, item) {
        if (item && nonDuplicates.indexOf(item) === -1) {
            nonDuplicates.push(item);
        }
        return nonDuplicates;
    }, []);
}

module.exports = removeEmptiesAndDuplicates;
